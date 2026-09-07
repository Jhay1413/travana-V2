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

// The interpreter tries a rule's jsonPath FIRST and only then falls back to the
// named source, so a rule that reads the API JSON still needs a valid `from` for
// its fallback. The AI regularly invents "json"/"api"/"apiJson" for those rules;
// rejecting them threw away the entire spec over a field that would have worked.
// Normalise instead — anything unrecognised becomes "text".
//
// "headings" MUST be listed here. The system prompt tells the AI to read
// quote_title from the headings list by POSITION, and the interpreter
// implements that source — but while this enum omitted it, every such rule was
// normalised to "text" and the positional regex then counted lines of the page
// BODY instead. Carnival's title came out "IMPORTANT NOTICE" (the second line
// of a site banner) rather than the voyage name in the second heading.
// "deepText" MUST be listed here too, for the identical reason "headings"
// is: it is a real FieldSource the interpreter implements (the full DOM text,
// including collapsed/hidden nodes — see extraction.interpreter.ts), and an
// omission here would silently rewrite every such rule to "text" exactly like
// the headings bug above did.
const SOURCES = ['text', 'title', 'url', 'images', 'headings', 'deepText'] as const;
const normaliseFrom = (v: unknown): unknown => {
  if (typeof v !== 'string') return 'text';
  const s = v.trim().toLowerCase();
  // Case-insensitive match against the CANONICALLY-cased source name — not a
  // plain lowercase includes() — because "deepText" is the one source whose
  // canonical spelling isn't already all-lowercase. Comparing lowercase-to-
  // lowercase but then returning the lowercased input would return "deeptext",
  // which the enum below rejects, so the AI's own correctly-spelled
  // "deepText" would be normalised away to "text".
  const match = (SOURCES as readonly string[]).find((src) => src.toLowerCase() === s);
  return match ?? 'text';
};

// Exported for tests: extraction.types.ts's FieldRule and this schema must
// agree on every key, and this repo has now been bitten THREE times by a key
// existing on the type but not here — Zod strips unknown keys silently, so
// each one vanished on its way through the validator rather than failing
// loudly ("headings" and "imageContainerIncludes" as spec-level sources,
// above; "deepText" as a FieldSource). The provenance keys below
// (origin/verifiedValue/strategy/pickedAt, added for picker-spec.ts) are the
// newest addition, so they are listed here in the same breath as they're
// added to FieldRule — see spec-sources.test.ts's FieldRule round-trip test,
// which fails to COMPILE if a future FieldRule key is added without a sample
// here.
export const fieldRuleSchema = z.object({
  from: z.preprocess(normaliseFrom, z.enum(SOURCES)),
  jsonPath: z.preprocess(nullToUndef, z.string().optional()),
  regex: z.preprocess(nullToUndef, z.string().optional()),
  group: z.preprocess(nullToUndef, z.number().int().optional()),
  urlSegment: z.preprocess(nullToUndef, z.number().int().optional()),
  transform: z.preprocess(nullToUndef, z.enum(['number', 'date', 'titleCase', 'trim', 'lower', 'upper']).optional()),
  map: z.preprocess(nullToUndef, z.record(z.string(), z.string()).optional()),
  fallback: z.preprocess(nullToUndef, z.union([z.string(), z.number()]).optional()),
  // Provenance metadata only (extraction.types.ts) — the interpreter never
  // reads these when running a rule. The AI never emits them (they're not in
  // SYSTEM_PROMPT); they're written by deriveSpecFromPicks (picker-spec.ts)
  // when a human verifies a field by clicking it, and read back by the
  // review UI / mergePickedIntoSpec's `replaced` reporting.
  origin: z.preprocess(nullToUndef, z.enum(['picked', 'generated']).optional()),
  verifiedValue: z.preprocess(nullToUndef, z.string().optional()),
  strategy: z.preprocess(nullToUndef, z.string().optional()),
  pickedAt: z.preprocess(nullToUndef, z.string().optional()),
});

// Exported for tests: the validator and the interpreter must agree on the set
// of field sources, and they silently drifted apart once already.
export const specSchema = z.object({
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
  // Sibling of the `headings`-enum bug above: this key exists in ExtractionSpec
  // (extraction.types.ts) and is read by the interpreter (extraction.interpreter.ts,
  // selectGalleryImages), but was never added here — Zod strips unknown keys, so
  // every spec that set it silently lost it before it ever reached the
  // interpreter. Keep specSchema and ExtractionSpec in lockstep; the round-trip
  // test in spec-sources.test.ts exists to catch the next one of these.
  imageContainerIncludes: z.preprocess(nullToUndef, z.string().optional()),
  flightModalTrigger: z.preprocess(nullToUndef, z.string().optional()),
  // Declared, not inferred. See extraction.types.ts for why: an inferred type
  // dropped Virgin Voyages' entire cruise block when its ship_name regex
  // matched nothing. The AI is told (SYSTEM_PROMPT) to emit the ONE package
  // type it decided the page is, and the interpreter treats it as authoritative.
  packageType: z.preprocess(nullToUndef, z.enum(['cruise', 'package-holiday', 'lodge']).optional()),
});

// Fields common to any deal, then package-type-specific ones. The page is ONE
// type — the AI only includes the fields it actually finds.
const COMMON_FIELDS = [
  'adults', 'children', 'infants', 'no_of_nights', 'travel_date',
  'price_per_person', 'sales_price', 'tourist_tax_total', 'currency',
  'tour_operator', 'country', 'destination', 'resort', 'quote_title',
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

You are given a page's title, its deep-link URL, and its visible innerText. First decide which ONE package type the page is, and put that decision in the output as "packageType" — do NOT leave it for the interpreter to guess from which fields happen to resolve. A Virgin Voyages spec whose "ship_name" regex was pinned to one voyage's wording matched nothing on the next voyage, and inference then read the missing ship as "not a cruise" and silently dropped the entire cruise block — the line, the sailing date, the cabin, the itinerary. "packageType" ends that: it says what the page IS regardless of which individual field rules end up missing.

Always try to extract the COMMON fields: ${COMMON_FIELDS.join(', ')}.

Then add ONLY the fields for the package type this page actually is, and set "packageType" to match:
- PACKAGE HOLIDAY (hotel + flights): "packageType": "package-holiday", plus ${PACKAGE_HOLIDAY_FIELDS.join(', ')}.
- CRUISE (ship sailing): "packageType": "cruise", plus ${CRUISE_FIELDS.join(', ')}. You may also add an "itineraryRegex" (matchAll; group1 = day number or "Day 3", group2 = the day's port/description) for the day-by-day plan.
- HOT TUB BREAK / LODGE (self-catering lodge/cottage with a hot tub, e.g. Hoseasons/Haven/Parkdean): "packageType": "lodge", plus ${LODGE_FIELDS.join(', ')}. For a lodge, "accommodation" is the LODGE/COTTAGE name and "lodge_park_name" is the HOLIDAY PARK it sits in — extract BOTH; without them the park/lodge won't populate. For hot_tub, a rule that matches the words "hot tub" is enough (the interpreter treats any non-empty match as true); pets uses transform "number".

Always extract "accommodation" (the property/lodge/hotel name — usually in the page title or the main heading) and the "sales_price" / "price_per_person" total, on every page type. A spec that only reads URL params (dates, occupancy) and no page content is WRONG — read the rendered text for the name and price.

Output ONLY a JSON object with this shape:
{
  "version": 1,
  "packageType": "cruise"|"package-holiday"|"lodge",
  "wait": { "textMatches": "<regex that appears once the priced quote has rendered, e.g. a currency amount>", "timeoutMs": 30000 },
  "constants": { "tour_operator": "<operator name>", "currency": "GBP" },
  "fields": {
    "<fieldName>": { "from": "text"|"title"|"url"|"images"|"headings"|"deepText", "regex": "<JS regex; capture group 1 is the value>", "group": 1, "transform": "number"|"date"|"titleCase"|null, "urlSegment": <int, only for from:url>, "map": {"raw":"canonical"}, "fallback": <value> }
  },
  "luggageRegex": "<optional matchAll regex; group1=count, group2=label>",
  "flightModalTrigger": "<optional: case-insensitive regex matching the visible text of a button/link that opens a flight-details or 'compare airports/dates' popup — see below>",
  "imageUrlIncludes": "<optional: a substring of the property gallery image URLs, if you can tell one>"
}

Rules:
- from "text" = the page innerText, "title" = page title, "url" = the deep-link URL (use urlSegment to pick a path segment, 0-indexed), "headings" = the page's h1/h2 text, ONE PER LINE in document order, "deepText" = the full DOM text, INCLUDING content that is collapsed/hidden (accordion panels, closed tabs, drawers) — see the dedicated rule below before using it.
- "from" MUST be exactly one of: "text", "title", "url", "images", "headings", "deepText". There is no "json" source — to read the API JSON you add a "jsonPath" and leave "from" as the DOM fallback (usually "text"). jsonPath is always tried FIRST when present.
- "deepText" is a LAST RESORT, not a substitute for "text": prefer "text" for everything. Use "deepText" ONLY when you are given it AND a value you need genuinely does not appear anywhere in the visible "text" — the case this exists for is a cruise's day-by-day itinerary sitting inside a drawer/panel that was collapsed when the page was captured (e.g. a "View Ports" section), so the itinerary text exists in the DOM but not in innerText. Do NOT write loose "deepText" rules for ordinary fields (price, name, dates): deepText also contains inactive tabs, OTHER cabin grades, and pre-rendered alternatives that were never shown to the user, so a rule that would be safe against "text" can match the wrong one of several near-duplicate values when run against "deepText".
- quote_title is the deal's HEADLINE as the portal writes it — the hotel name on most portals, a marketing strapline on some (e.g. "Five-star escape nestled near the Mediterranean Sea"). It is almost always an h1/h2, so read it with from "headings" and anchor it BY POSITION, not by wording: "^([^\\n]+)" takes the first heading, "^[^\\n]*\\n([^\\n]+)" the second, and so on. Never pin it to this page's literal words — the next deal's headline is different text. You are given the headings list; count the lines to find which position holds the deal's headline and write the rule for that position. Omit quote_title if no heading holds it — the interpreter then falls back to the hotel name.
- If an API JSON is provided, prefer it for a field by adding "jsonPath" (dot/bracket path, e.g. "offers[0].price"). The interpreter tries jsonPath first and falls back to the regex on the DOM — so give BOTH a jsonPath (from the API) AND a regex (from the DOM) when the field appears in both. This is how API data and DOM data merge.
- Use transform "number" for prices/counts (strips £ and commas), "date" for dates (any of "06 Sep 2026", "06-09-2026", ISO — the interpreter normalises to YYYY-MM-DD), "titleCase" for URL slugs.
- board_basis must map to one of: All Inclusive, All Inclusive Plus, Half Board, Half Board Plus, Full Board, Full Board Plus, Bed and Breakfast, Self Catering, Room Only.
- transfer_type must map to one of: Private Transfer, Shared Transfer, None. Use "map" and a "fallback":"None".
- Prefer from:"url" with urlSegment for country/destination/resort when the URL path encodes them.
- Only include a field if you can actually find it on THIS page. Escape backslashes for JSON (\\d, \\s).
- Regexes run case-insensitively. Anchor them to the LABELS visible on the page — never to this page's VALUES.
- GENERALITY (critical): the spec is saved and reused for EVERY future deal on this supplier's site — this page is only ONE example. A rule whose regex is this page's literal value (e.g. board_basis "Half Board", room_type "Standard Double or Twin room", or a place name like "(salou)") extracts NOTHING on the next deal and is WRONG. Every rule must CAPTURE whatever value appears:
  - board_basis: match the whole canonical vocabulary, e.g. "(All Inclusive Plus|All Inclusive|Half Board Plus|Half Board|Full Board Plus|Full Board|Bed and Breakfast|Self Catering|Room Only)".
  - room_type: anchor on the STRUCTURAL marker beside the name — the "ROOM 1" heading above it, or the "Sleeps:"/occupancy line below it — and capture that whole line, e.g. "ROOM\\s*\\d+\\s*\\n+\\s*([^\\n]+)" or "\\n([^\\n]+)\\n+\\s*Sleeps:". Do NOT key on the words room/suite/apartment/villa: rules run CASE-INSENSITIVELY, so such a rule also matches those words inside ordinary prose — a rule like "([\\w ]+(?:room|suite))" happily captured the caption "Best room choice according to your selected duration and dates". The same warning applies to any field whose value is a proper noun on its own line (accommodation, resort): anchor on the neighbouring label, never on a word that also occurs in body text.
  - from "url" with urlSegment: the segment POSITION carries the meaning — capture it generically with "([^/?#]+)" (or omit the regex entirely to take the whole segment). Never pin it to this page's slug.
- FLIGHT TIMES: package pages often show only the departure airport in the visible text and hide the exact flight times + destination airport behind a popup opened by a control such as "Compare airport, dates & prices" or "Flight details". If you see such a control's text on the page, set "flightModalTrigger" to a regex matching that control's visible label (e.g. "compare airport" ). The scraper will click it and read the times — you do NOT write regexes for the times themselves.
- A field's "from" may be "images": the rule's regex then runs over the list of the page's image URLs (one per line). Use this only when a value (e.g. a destination airport code) appears solely in image filenames.
- REJECTED CONSTRUCTS (a spec containing any of these is refused before storage, not just discouraged — each is a bug that has already shipped):
  - "group": 0 returns the WHOLE regex match, never a captured value, unless you also give "map" to translate that whole match. TUI's arrival-airport rule used group 0 on a regex that matched a full marketing sentence, so every deal recorded that sentence as the airport name.
  - "fallback" must be a fixed vocabulary value (a board_basis/transfer_type value from the lists above) or a number — never a page-specific proper noun (a place name, an operator/ship/person name). TUI's arrival-airport rule fell back to "Prague", so every deal that missed the regex recorded Prague as its airport.
  - Every "|" in a regex must sit INSIDE a "(...)" group or a "[...]" class. A top-level "|" splits the WHOLE pattern into unrelated alternatives. Jet2's "(Manchester|Newcastle)\\s*\\(MAN|NCL\\)" has this bug — the second "|" is top-level, so the rule matched nothing on its own source page.
  - Do not anchor a regex on more than ~30 characters of literal page prose. Carnival anchored price_per_person on the full sentence "Rates are in US Dollars, average per person and based on double occupancy." — it broke the moment that copy changed. Anchor on short labels, not sentences.`;

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

// ─── Post-generation rule safety checks (§4 Phase 2) ─────────────────────────
//
// specSchema only checks SHAPE — it happily accepts a spec that parses cleanly
// but is semantically broken (Phase 2's "schema-valid is not correct" point).
// These checks catch four constructs that have each already shipped as a live
// bug, so they REJECT the whole spec rather than warn. Exported as a pure
// function so it's unit-testable without an AI call, and reusable later to
// audit specs already sitting in storage.

export interface RuleProblem {
  field: string;
  reason: string;
}

// The only strings a "fallback" is allowed to be a proper noun for: the fixed
// vocabulary the system prompt asks board_basis/transfer_type to map onto.
// Everything else that looks like a proper noun is page-specific (a place,
// operator, ship or person name) and has no business being a cross-deal
// default — see the "Prague" case below.
const CANONICAL_VOCABULARY = new Set<string>([
  'All Inclusive', 'All Inclusive Plus', 'Half Board', 'Half Board Plus',
  'Full Board', 'Full Board Plus', 'Bed and Breakfast', 'Self Catering', 'Room Only',
  'Private Transfer', 'Shared Transfer', 'None',
]);

// A capitalised word or phrase, e.g. "Prague" or "New York" — deliberately
// excludes ALL-CAPS tokens like "GBP" so legitimate currency-code fallbacks
// aren't flagged.
const PROPER_NOUN_FALLBACK = /^[A-Z][a-z]+(?:[ -][A-Z][a-z]+)*$/;

// Regex escape sequences that are themselves metacharacters (character
// classes, anchors, backreferences) rather than an escaped literal — \d, \s
// etc. don't count toward a literal run, but \. or \$ do: they represent one
// literal character in the text being matched.
const ESCAPED_META_CLASSES = new Set([
  'd', 'D', 'w', 'W', 's', 'S', 'b', 'B', 'n', 'r', 't', 'v', 'f',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'u', 'x', 'k', 'p', 'P',
]);

const LITERAL_RUN_LIMIT = 30;
// A group-0 rule RETURNS its literal as the value, so the limit there is about
// distinguishing a name from a sentence, not an anchor from a value. Set above
// the longest real place name seen in a stored spec ("Hong Kong SAR, China")
// and well below TUI's 60-character whole-sentence airport bug.
const DETECTOR_LITERAL_LIMIT = 45;

// Detects a "|" that sits OUTSIDE every group/class — i.e. one that splits the
// whole pattern into two independent alternatives rather than offering
// alternatives within a group. Jet2's "(Manchester|Newcastle)\s*\(MAN|NCL\)"
// is exactly this: the second "|" is top-level, so the pattern is really
// "(Manchester|Newcastle)\s*\(MAN" OR "NCL\)" — against "Newcastle (NCL)" it
// matches the second branch, "NCL)", with capture group 1 undefined. The rule
// extracted nothing on the very page it was generated from.
//
// A "|" inside "(...)" or "[...]" is fine (board_basis's vocabulary
// alternation depends on it) and must not be flagged — depth-tracking below
// only counts a bare top-level pipe, and character-class contents are skipped
// entirely regardless of parenthesis depth. Escaped "\|" is a literal pipe
// character, not alternation, and is skipped via the leading backslash check.
function hasTopLevelPipe(pattern: string): boolean {
  let depth = 0;
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      i++; // escaped char (incl. `\|`, `\(`, `\[`) is literal — skip it whole
      continue;
    }
    if (inClass) {
      if (ch === ']') inClass = false;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      continue;
    }
    if (ch === '(') {
      depth++;
      continue;
    }
    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (ch === '|' && depth === 0) return true;
  }
  return false;
}

// Longest run of characters that match LITERALLY rather than as regex syntax —
// i.e. a hardcoded run of page prose. Carnival's price_per_person rule anchors
// on "Rates are in US Dollars, average per person and based on double
// occupancy." purely because that sentence happened to sit next to the price
// on the page the spec was generated from; the moment the copy is reworded,
// the rule (and the price) is gone. Character classes and quantifiers reset
// the run since they match a VARYING span, not a fixed literal one.
function longestLiteralRun(pattern: string): number {
  let max = 0;
  let current = 0;
  let inClass = false;
  let inBrace = false; // a {n,m} quantifier — its digits aren't literal text
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\') {
      const next = pattern[i + 1];
      i++;
      if (next !== undefined && ESCAPED_META_CLASSES.has(next)) {
        current = 0; // e.g. \d, \s — matches a class of chars, not one literal
      } else {
        current += 1; // e.g. \. \$ \( — an escaped literal character
        max = Math.max(max, current);
      }
      continue;
    }
    if (inClass) {
      if (ch === ']') inClass = false;
      current = 0;
      continue;
    }
    if (inBrace) {
      if (ch === '}') inBrace = false;
      current = 0;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      current = 0;
      continue;
    }
    if (ch === '{') {
      inBrace = true;
      current = 0;
      continue;
    }
    if ('^$.*+?(){}|'.includes(ch)) {
      current = 0;
      continue;
    }
    current += 1;
    max = Math.max(max, current);
  }
  return max;
}

// A rule that reads group 0 returns the WHOLE match as the value, which makes
// three of the checks below inapplicable — see each one. `group` defaults to 1
// when unset, so only an explicit 0 counts.
function readsWholeMatch(rule: { group?: number; map?: Record<string, string> }): boolean {
  return rule.group === 0;
}

// Boolean flags are DETECTED, not extracted: the interpreter treats any
// non-empty match as true, and the system prompt itself tells the AI that
// matching the literal words "hot tub" is enough. For these a long literal IS
// the rule's whole purpose, so the anchor-length check must not fire on them.
const FLAG_FIELDS = new Set(['cruise_only', 'hot_tub', 'pets']);

// The supplier's OWN identity is a per-supplier constant, so a proper-noun
// fallback naming it is correct, not overfitting: Royal Caribbean's spec falls
// back to "Royal Caribbean" and Virgin Voyages' to "Virgin Voyages", and both
// are right on every page of those sites forever. The Prague bug was a
// fallback on a VARIABLE field — an arrival airport, which differs per deal —
// recording one page's example as every deal's answer. Rejecting these blocked
// real cruise imports.
const SUPPLIER_IDENTITY_FIELDS = new Set(['cruise_line', 'tour_operator']);

function checkRegex(
  field: string,
  regex: string | undefined,
  rule: { group?: number; map?: Record<string, string> },
  problems: RuleProblem[],
): void {
  if (!regex) return;
  // A top-level "|" only destroys a CAPTURE — the Jet2 bug was that
  // "(Manchester|Newcastle)\s*\(MAN|NCL\)" split so that group 1 was
  // unreachable. Reading group 0 returns whatever matched, so alternation is
  // not just safe there but idiomatic: a real stored rule reads
  // "Hong Kong SAR, China|Hong Kong" exactly that way.
  if (!readsWholeMatch(rule) && hasTopLevelPipe(regex)) {
    problems.push({
      field,
      reason:
        `regex ${JSON.stringify(regex)} has a "|" outside any group/class, splitting the whole ` +
        `pattern into unrelated alternatives (Jet2's "(Manchester|Newcastle)\\s*\\(MAN|NCL\\)" matched ` +
        `nothing on its own source page for exactly this reason)`,
    });
  }
  const run = longestLiteralRun(regex);
  // The danger is a long literal used as an ANCHOR beside a capture — that is
  // Carnival's case, where the rule broke the moment the marketing copy moved.
  // Two shapes are legitimately literal and must not be flagged:
  //   • a flag field, where matching the phrase IS the detection, and
  //   • a group-0 detector, where the literal is the VALUE being recognised
  //     ("Hong Kong Island West" as a resort) rather than scaffolding around one.
  // Group-0 rules are still capped, well above a place name, because TUI's
  // whole-sentence airport bug WAS a group-0 rule.
  const limit = readsWholeMatch(rule) ? DETECTOR_LITERAL_LIMIT : LITERAL_RUN_LIMIT;
  if (!FLAG_FIELDS.has(field) && run > limit) {
    problems.push({
      field,
      reason:
        `regex ${JSON.stringify(regex)} hardcodes a literal run of ${run} characters, anchoring the ` +
        `rule to this page's exact wording (Carnival's price_per_person rule anchored on the full ` +
        `sentence "Rates are in US Dollars, average per person and based on double occupancy." and ` +
        `broke the moment that copy changed)`,
    });
  }
}

// Exported for tests, and for reuse as an audit over specs already in storage.
export function findUnsafeRules(spec: ExtractionSpec): RuleProblem[] {
  const problems: RuleProblem[] = [];

  for (const [field, rule] of Object.entries(spec.fields)) {
    // group: 0 returns the WHOLE match as the value. That is a legitimate and
    // widely-used idiom — a PRESENCE DETECTOR, where recognising the text is
    // the whole point: stored specs read "Hong Kong Island West" as a resort,
    // "Transfer included" as a transfer type, "hot tub" as a flag. Flagging
    // group 0 on its own rejected all of those and blocked real imports.
    //
    // What made TUI's arrival-airport rule a bug was not group 0, it was that
    // the thing being returned was a 60-character SENTENCE ("to your hotel,
    // and back to the airport at the end of your stay") rather than a value.
    // So the length check below is what catches it; a `map` still exempts a
    // rule outright, since a map states exactly which whole-match values are
    // expected.
    checkRegex(field, rule.regex, rule, problems);
    // A fallback that's a page-specific proper noun rather than fixed
    // vocabulary. TUI's arrival-airport rule fell back to "Prague", so every
    // deal that missed the regex recorded Prague as its airport.
    if (
      typeof rule.fallback === 'string' &&
      !SUPPLIER_IDENTITY_FIELDS.has(field) &&
      PROPER_NOUN_FALLBACK.test(rule.fallback) &&
      !CANONICAL_VOCABULARY.has(rule.fallback)
    ) {
      problems.push({
        field,
        reason: `fallback ${JSON.stringify(rule.fallback)} looks like a page-specific proper noun, not a ` +
          'fixed vocabulary value — every deal that misses the regex would record this page\'s example as ' +
          'the value (TUI\'s fallback:"Prague" on arrival_airport_name did exactly this)',
      });
    }
  }

  // luggageRegex/itineraryRegex are the same regex shape as a field rule and
  // carry the same two structural risks.
  checkRegex('luggageRegex', spec.luggageRegex, {}, problems);
  checkRegex('itineraryRegex', spec.itineraryRegex, {}, problems);

  return problems;
}

export const extractionAiService = {
  async generateSpecFromDom(
    dom: { title: string; text: string; url: string; apiJson?: unknown; headings?: string[]; deepText?: string },
    supplierName?: string,
  ): Promise<ExtractionSpec> {
    const openai = getOpenAI();
    const clipped = dom.text.length > 16_000 ? dom.text.slice(0, 16_000) : dom.text;
    // Numbered so the AI can count positions and write a positional quote_title
    // rule. Absent on captures from a pre-v7 bookmarklet — the block is then
    // omitted entirely and the interpreter's hotel-name fallback applies.
    const headingsBlock = dom.headings?.length
      ? `\n\nPage headings (h1/h2), in document order — line 1 is the first:\n"""\n${dom.headings.join('\n')}\n"""`
      : '';
    // Include the captured API JSON (truncated) so the AI can prefer jsonPath.
    let apiBlock = '';
    if (dom.apiJson != null) {
      const apiStr = JSON.stringify(dom.apiJson);
      apiBlock = `\n\nCaptured API JSON (prefer jsonPath for fields found here):\n"""\n${apiStr.length > 8_000 ? apiStr.slice(0, 8_000) : apiStr}\n"""`;
    }
    // Only sent when the bookmarklet captured it (absent on every pre-deepText
    // capture) — the full DOM text including collapsed/hidden content, so the
    // AI can write a "deepText" rule for the rare value that is genuinely
    // absent from the visible text (see SYSTEM_PROMPT's "deepText" rule).
    // Labelled explicitly as hidden/collapsed content so the model doesn't
    // treat it as a second, more-complete copy of the visible text.
    const deepTextBlock = dom.deepText
      ? `\n\nFull DOM text, INCLUDING collapsed/hidden content (drawers, closed accordion panels, inactive tabs) — use "deepText" as the "from" ONLY for a value missing from the visible innerText above:\n"""\n${dom.deepText.length > 20_000 ? dom.deepText.slice(0, 20_000) : dom.deepText}\n"""`
      : '';

    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1800,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Supplier: ${supplierName ?? '(unknown)'}\nPage title: ${dom.title}\nDeep-link URL: ${dom.url}\n\nPage innerText:\n"""\n${clipped}\n"""${headingsBlock}${apiBlock}${deepTextBlock}`,
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
    const spec = parsed.data as ExtractionSpec;

    // Schema-valid is not correct (§3/§4 Phase 2): reject the constructs behind
    // TUI's Prague fallback, Jet2's dead alternation and Carnival's
    // marketing-sentence anchor at generation time, rather than storing them
    // and finding out from a customer-facing wrong value.
    // DROP the offending RULES, never the import. Throwing here failed the
    // whole capture with a 502 and left the agent with nothing — which breaks
    // the rule this project already settled on: validation warns, it never
    // blocks, because the agent needs the deal in front of them (see
    // EXTRACTION_AUDIT.md §5, "Hard-fail on validation"). One bad rule out of
    // twenty is a missing field the agent types by hand; a 502 is a dead end.
    //
    // The dropped field simply has no rule, so it falls through to the same
    // constants / supplier-neutral conventions / defaults that a rule which
    // merely MISSED would have fallen through to.
    const problems = findUnsafeRules(spec);
    if (problems.length > 0) {
      const fields = new Set(problems.map((p) => p.field));
      const kept = Object.fromEntries(Object.entries(spec.fields).filter(([field]) => !fields.has(field)));
      return { ...spec, fields: kept };
    }
    return spec;
  },
};
