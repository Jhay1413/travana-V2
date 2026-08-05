import { z } from 'zod';
import { CHAT_MODEL, getOpenAI } from '../../../utils/ai-model';
import { AppError } from '../../../utils/error-handler';
import type { ExtractionSpec } from './extraction.types';

// AI generation of a declarative extraction spec from a captured DOM. The AI
// only outputs DATA (regex/transform rules), which the fixed interpreter runs —
// no AI-written code is ever executed. Output is validated before use.

// The AI sometimes emits null for fields it means to omit; treat null as absent
// so a single null can't fail the whole spec.
const nullToUndef = (v: unknown): unknown => (v === null ? undefined : v);

const fieldRuleSchema = z.object({
  from: z.preprocess((v) => v ?? 'text', z.enum(['text', 'title', 'url', 'images'])),
  jsonPath: z.preprocess(nullToUndef, z.string().optional()),
  regex: z.preprocess(nullToUndef, z.string().optional()),
  group: z.preprocess(nullToUndef, z.number().int().optional()),
  urlSegment: z.preprocess(nullToUndef, z.number().int().optional()),
  transform: z.preprocess(nullToUndef, z.enum(['number', 'date', 'titleCase', 'trim', 'lower', 'upper']).optional()),
  map: z.preprocess(nullToUndef, z.record(z.string(), z.string()).optional()),
  fallback: z.preprocess(nullToUndef, z.union([z.string(), z.number()]).optional()),
});

const specSchema = z.object({
  version: z.preprocess((v) => v ?? 1, z.number()),
  wait: z.preprocess(
    nullToUndef,
    z
      .object({
        textMatches: z.preprocess(nullToUndef, z.string().optional()),
        timeoutMs: z.preprocess(nullToUndef, z.number().optional()),
      })
      .optional(),
  ),
  constants: z.preprocess(nullToUndef, z.record(z.string(), z.union([z.string(), z.number()])).optional()),
  fields: z.record(z.string(), fieldRuleSchema),
  luggageRegex: z.preprocess(nullToUndef, z.string().optional()),
  itineraryRegex: z.preprocess(nullToUndef, z.string().optional()),
  imageUrlIncludes: z.preprocess(nullToUndef, z.string().optional()),
  flightModalTrigger: z.preprocess(nullToUndef, z.string().optional()),
});

// Fields common to any deal, then package-type-specific ones. The page is ONE
// type — the AI only includes the fields it actually finds.
const COMMON_FIELDS = [
  'adults', 'children', 'infants', 'no_of_nights', 'travel_date',
  'price_per_person', 'sales_price', 'tourist_tax_total', 'currency',
  'tour_operator', 'country', 'destination', 'resort',
];
const PACKAGE_HOLIDAY_FIELDS = [
  'accommodation', 'board_basis', 'room_type', 'departure_airport_name',
  'arrival_airport_name', 'transfer_type', 'star_rating', 'review_score',
];
const CRUISE_FIELDS = [
  'cruise_line', 'ship_name', 'cruise_date', 'cruise_title', 'embarkation',
  'debarkation', 'cabin_type', 'cabin_number', 'cruise_only',
];
const LODGE_FIELDS = ['lodge_type', 'lodge_park_name', 'cottage_id', 'hot_tub', 'pets'];

const SYSTEM_PROMPT = `You write a JSON "extraction spec" that a fixed interpreter uses to read a travel deal from a rendered web page. You NEVER write code — only declarative rules (regex + transforms).

You are given a page's title, its deep-link URL, and its visible innerText. First decide which ONE package type the page is, then extract the relevant fields.

Always try to extract the COMMON fields: ${COMMON_FIELDS.join(', ')}.

Then add ONLY the fields for the package type this page actually is:
- PACKAGE HOLIDAY (hotel + flights): ${PACKAGE_HOLIDAY_FIELDS.join(', ')}.
- CRUISE (ship sailing): ${CRUISE_FIELDS.join(', ')}. You may also add an "itineraryRegex" (matchAll; group1 = day number or "Day 3", group2 = the day's port/description) for the day-by-day plan.
- HOT TUB BREAK / LODGE (self-catering lodge/cottage with a hot tub, e.g. Hoseasons/Haven/Parkdean): ${LODGE_FIELDS.join(', ')}. For a lodge, "accommodation" is the LODGE/COTTAGE name and "lodge_park_name" is the HOLIDAY PARK it sits in — extract BOTH; without them the park/lodge won't populate. For hot_tub, a rule that matches the words "hot tub" is enough (the interpreter treats any non-empty match as true); pets uses transform "number".

Always extract "accommodation" (the property/lodge/hotel name — usually in the page title or the main heading) and the "sales_price" / "price_per_person" total, on every page type. A spec that only reads URL params (dates, occupancy) and no page content is WRONG — read the rendered text for the name and price.

Output ONLY a JSON object with this shape:
{
  "version": 1,
  "wait": { "textMatches": "<regex that appears once the priced quote has rendered, e.g. a currency amount>", "timeoutMs": 30000 },
  "constants": { "tour_operator": "<operator name>", "currency": "GBP" },
  "fields": {
    "<fieldName>": { "from": "text"|"title"|"url", "regex": "<JS regex; capture group 1 is the value>", "group": 1, "transform": "number"|"date"|"titleCase"|null, "urlSegment": <int, only for from:url>, "map": {"raw":"canonical"}, "fallback": <value> }
  },
  "luggageRegex": "<optional matchAll regex; group1=count, group2=label>",
  "flightModalTrigger": "<optional: case-insensitive regex matching the visible text of a button/link that opens a flight-details or 'compare airports/dates' popup — see below>",
  "imageUrlIncludes": "<optional: a substring of the property gallery image URLs, if you can tell one>"
}

Rules:
- from "text" = the page innerText, "title" = page title, "url" = the deep-link URL (use urlSegment to pick a path segment, 0-indexed).
- If an API JSON is provided, prefer it for a field by adding "jsonPath" (dot/bracket path, e.g. "offers[0].price"). The interpreter tries jsonPath first and falls back to the regex on the DOM — so give BOTH a jsonPath (from the API) AND a regex (from the DOM) when the field appears in both. This is how API data and DOM data merge.
- Use transform "number" for prices/counts (strips £ and commas), "date" for dates (any of "06 Sep 2026", "06-09-2026", ISO — the interpreter normalises to YYYY-MM-DD), "titleCase" for URL slugs.
- board_basis must map to one of: All Inclusive, All Inclusive Plus, Half Board, Half Board Plus, Full Board, Full Board Plus, Bed and Breakfast, Self Catering, Room Only.
- transfer_type must map to one of: Private Transfer, Shared Transfer, None. Use "map" and a "fallback":"None".
- Prefer from:"url" with urlSegment for country/destination/resort when the URL path encodes them.
- Only include a field if you can actually find it on THIS page. Escape backslashes for JSON (\\d, \\s).
- Regexes run case-insensitively. Keep them specific to the labels visible on the page.
- FLIGHT TIMES: package pages often show only the departure airport in the visible text and hide the exact flight times + destination airport behind a popup opened by a control such as "Compare airport, dates & prices" or "Flight details". If you see such a control's text on the page, set "flightModalTrigger" to a regex matching that control's visible label (e.g. "compare airport" ). The scraper will click it and read the times — you do NOT write regexes for the times themselves.
- A field's "from" may be "images": the rule's regex then runs over the list of the page's image URLs (one per line). Use this only when a value (e.g. a destination airport code) appears solely in image filenames.`;

// ─── AI login-config generation ──────────────────────────────────────────────
// Given a login page's form HTML, the AI returns the CSS selectors needed to
// drive it. Only selectors (data) are produced — the fixed login routine uses
// them. The orchestrator then verifies login actually succeeded.

const loginConfigSchema = z.object({
  usernameSelector: z.string().min(1),
  passwordSelector: z.string().min(1),
  submitSelector: z.string().min(1),
  // Extra identifier field some portals require before the username (e.g. Jet2's
  // ABTA number, an agency id, a membership number).
  abtaSelector: z.string().optional(),
  // A selector present only when the login form is showing (readiness marker).
  formSelector: z.string().min(1),
  // Element that would hold a login error message, if identifiable.
  errorSelector: z.string().optional(),
  // True when the form indicates credentials must be UPPERCASE.
  uppercaseCredentials: z.boolean().optional(),
});

export type GeneratedLoginConfig = z.infer<typeof loginConfigSchema>;

const LOGIN_SYSTEM_PROMPT = `You are given the HTML of a website login form. Return ONLY a JSON object of CSS selectors a browser automation will use to fill and submit it:
{
  "usernameSelector": "<selector for the username/email/login field>",
  "passwordSelector": "<selector for the password field>",
  "submitSelector": "<selector for the button that submits the form>",
  "abtaSelector": "<selector for an EXTRA required id field if present — ABTA number, agency id, membership number — else omit>",
  "formSelector": "<a selector that exists only while the login form is shown, used as a readiness check>",
  "errorSelector": "<selector of the element that would show a login error, if identifiable, else omit>",
  "uppercaseCredentials": <true if the form indicates credentials must be UPPERCASE, e.g. a label reads "(Uppercase)"; else omit>
}

Rules:
- Prefer stable "#id" selectors; otherwise use [name="..."] or a specific class.
- If several buttons match, pick the one that actually submits credentials (type="submit" inside the login form). If duplicate buttons exist (one hidden), still return a selector that matches the visible one — the automation clicks the visible match.
- The page may show BOTH a "register/sign-up" form and a "returning agents login" form. Only map the LOGIN form's fields.
- If there is NO separate username/email field — the login uses only an agency/ABTA/membership NUMBER plus a password (common for travel-trade portals) — set usernameSelector to that number field and OMIT abtaSelector. Only set abtaSelector when there is ALSO a distinct username/email field. NEVER point usernameSelector and abtaSelector at the same element.
- Only include abtaSelector / errorSelector if you can clearly identify them.
- Output valid JSON only.`;

export const loginConfigAiService = {
  async generateFromHtml(formHtml: string, pageUrl?: string): Promise<GeneratedLoginConfig> {
    const openai = getOpenAI();
    const clipped = formHtml.length > 12_000 ? formHtml.slice(0, 12_000) : formHtml;
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 500,
      messages: [
        { role: 'system', content: LOGIN_SYSTEM_PROMPT },
        { role: 'user', content: `Login page URL: ${pageUrl ?? '(unknown)'}\n\nForm HTML:\n"""\n${clipped}\n"""` },
      ],
    });
    const raw = response.choices[0]?.message?.content?.trim() || '{}';
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AppError('AI returned invalid JSON for the login config', 502);
    }
    const parsed = loginConfigSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(`AI produced an invalid login config: ${parsed.error.errors[0].message}`, 502);
    }
    return parsed.data;
  },
};

export const extractionAiService = {
  async generateSpecFromDom(
    dom: { title: string; text: string; url: string; apiJson?: unknown },
    supplierName?: string,
  ): Promise<ExtractionSpec> {
    const openai = getOpenAI();
    const clipped = dom.text.length > 16_000 ? dom.text.slice(0, 16_000) : dom.text;
    // Include the captured API JSON (truncated) so the AI can prefer jsonPath.
    let apiBlock = '';
    if (dom.apiJson != null) {
      const apiStr = JSON.stringify(dom.apiJson);
      apiBlock = `\n\nCaptured API JSON (prefer jsonPath for fields found here):\n"""\n${apiStr.length > 8_000 ? apiStr.slice(0, 8_000) : apiStr}\n"""`;
    }

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Supplier: ${supplierName ?? '(unknown)'}\nPage title: ${dom.title}\nDeep-link URL: ${dom.url}\n\nPage innerText:\n"""\n${clipped}\n"""${apiBlock}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || '{}';
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      throw new AppError('AI returned invalid JSON for the extraction spec', 502);
    }
    const parsed = specSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError(`AI produced an invalid extraction spec: ${parsed.error.errors[0].message}`, 502);
    }
    return parsed.data as ExtractionSpec;
  },
};
