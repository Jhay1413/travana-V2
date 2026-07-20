import { CHAT_MODEL, getOpenAI } from "../../utils/ai-model";
import { z } from "zod";
import { AppError } from "../../utils/error-handler";
import { usageService } from "../usage/usage.service";
import type { EnquiryIntent } from "./ai-enquiry.types";

// The model reliably returns `null` (not `undefined`) for fields it can't
// infer, despite the prompt asking for "" / [] / null. Zod's `.default()`
// only fires on `undefined`, so every field is preprocessed to turn `null`
// into `undefined` first — that's what makes the defaults below actually
// apply to a `null` value instead of failing validation.
const nullToUndefined = (v: unknown): unknown => (v === null ? undefined : v);

// Same idea for array fields: strip `null`/`undefined` entries out of the
// array itself (e.g. `["Greece", null]`) so a single bad element can't fail
// the whole array.
const arrayNullToUndefined = (v: unknown): unknown => {
  if (v === null || v === undefined) return undefined;
  if (Array.isArray(v)) return v.filter((entry) => entry !== null && entry !== undefined);
  return v;
};

// Validation for the model's JSON so a malformed field can't break the client.
// Everything is coerced to a safe default rather than rejected.
// Exported so it can be unit tested independently of the OpenAI call.
export const intentSchema = z.object({
  // NOTE: `.default()` must live INSIDE the preprocess (on the inner schema),
  // not chained after it — ZodDefault only substitutes its default when the
  // raw value handed to it is `undefined`. If `.default()` were chained
  // after `z.preprocess()`, a `null` input would reach ZodDefault first
  // (still non-undefined), get forwarded into the preprocess step, get
  // converted to `undefined` there, and then fail the inner schema (which
  // has no default of its own) instead of resolving to a default.
  enquiryTitle: z.preprocess(nullToUndefined, z.string().default("")),
  holidayType: z.preprocess(nullToUndefined, z.string().default("")),
  countries: z.preprocess(arrayNullToUndefined, z.array(z.string()).default([])),
  destinations: z.preprocess(arrayNullToUndefined, z.array(z.string()).default([])),
  resorts: z.preprocess(arrayNullToUndefined, z.array(z.string()).default([])),
  departureAirports: z.preprocess(arrayNullToUndefined, z.array(z.string()).default([])),
  boardBasis: z.preprocess(arrayNullToUndefined, z.array(z.string()).default([])),
  starRating: z.preprocess(nullToUndefined, z.string().default("")),
  travelDate: z.preprocess(nullToUndefined, z.string().default("")),
  flexibility: z.preprocess(nullToUndefined, z.string().default("")),
  nights: z.number().nullable().default(null),
  adults: z.preprocess(nullToUndefined, z.number().default(2)),
  children: z.preprocess(nullToUndefined, z.number().default(0)),
  infants: z.preprocess(nullToUndefined, z.number().default(0)),
  childAges: z.preprocess(arrayNullToUndefined, z.array(z.number()).default([])),
  budget: z.preprocess(
    (v) => v ?? "",
    z.union([z.string(), z.number()]).transform((v) => String(v)),
  ),
  budgetType: z.preprocess(nullToUndefined, z.string().default("Per Person")),
  notes: z.preprocess(nullToUndefined, z.string().default("")),
  confidence: z.preprocess(nullToUndefined, z.enum(["low", "medium", "high"]).default("low")),
});

const SYSTEM_PROMPT = `You are an assistant for a UK travel agency. You read a customer conversation transcript and extract a structured holiday enquiry.

Return ONLY a JSON object with exactly these keys:
- enquiryTitle: a short human title, e.g. "Maldives Family Holiday" (infer from destination + who's travelling).
- holidayType: one of "Package Holiday", "Cruise Package", "Hot Tub Break" (default "Package Holiday" unless clearly a cruise or hot tub/lodge break).
- countries: array of country names mentioned (e.g. ["Greece"]).
- destinations: array of destination/region/island/city names (e.g. ["Crete", "Cancun"]).
- resorts: array of specific resort/hotel names if named.
- departureAirports: array of UK departure airport names (e.g. ["Manchester", "London Gatwick"]).
- boardBasis: array of any of: "All Inclusive", "Bed and Breakfast", "Self Catering", "Half Board", "Full Board", "Room Only".
- starRating: one of "2 Star", "3 Star", "4 Star", "5 Star" or "".
- travelDate: ISO date "YYYY-MM-DD" if a specific date/month is given (use the 1st for a month), else "".
- flexibility: e.g. "Exact Date", "+/- 3 Days", "+/- 7 Days", "Anytime in Month" or "".
- nights: number of nights as an integer, or null.
- adults, children, infants: integers (adults default 2 if unclear, children/infants default 0).
- childAges: array of child ages if given.
- budget: total or per-person amount as a number string (digits only, no currency symbol) or "".
- budgetType: "Per Person" or "Package".
- notes: a concise summary of any relevant preferences NOT captured above (specific hotels, must-haves, dietary needs, occasion, resort names, etc.). UK English.
- confidence: "low" | "medium" | "high" — how confident you are overall.

Rules: Only include what is stated or clearly implied. Leave unknown fields empty ("" / [] / null). Do NOT invent destinations, dates, or budgets. GBP is the currency. Output valid JSON only.`;

// Anchors the model's relative-date reasoning ("next month", "August", "next
// year") to the actual current date, since the model has no other notion of
// "today". Exported (and parameterized by `now`) so the date anchoring can be
// tested deterministically.
export function buildExtractionSystemPrompt(now: Date): string {
  const today = now.toISOString().slice(0, 10);
  const dateAnchor = `Today's date is ${today}. All travel dates must be in the future. If a day/month is given with no year, use the NEXT future occurrence. If only a month is given, use the 1st of that month in its next future occurrence. If the timing is a range or vague ("mid-August", "New Year", "school holidays"), leave travelDate "" and put the customer's wording in notes.`;
  return `${dateAnchor}\n\n${SYSTEM_PROMPT}`;
}

export const aiEnquiryService = {
  // Extracts a structured enquiry intent from a conversation transcript.
  // `orgId` is server-derived (getScope(req).orgId) and only used for usage
  // metering — it never affects the extraction itself.
  async fromTranscript(transcript: string, orgId?: string): Promise<EnquiryIntent> {
    const text = (transcript || "").trim();
    if (!text) throw new AppError("Conversation transcript is required", 400);
    // Guard against pathological input; keep well under model limits.
    const clipped = text.length > 24_000 ? text.slice(-24_000) : text;

    const openai = getOpenAI();
    let raw: string | undefined;
    try {
      const response = await openai.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: buildExtractionSystemPrompt(new Date()) },
          { role: "user", content: `Conversation transcript:\n\n${clipped}` },
        ],
      });
      raw = response.choices[0]?.message?.content?.trim();

      if (orgId && response.usage) {
        void usageService.recordAiUsage({
          orgId,
          feature: "enquiry_ai",
          model: CHAT_MODEL,
          usage: {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            cachedTokens: response.usage.prompt_tokens_details?.cached_tokens,
          },
        });
      }
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : "Failed to reach the AI service", 502);
    }
    if (!raw) throw new AppError("The AI returned an empty response", 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AppError("The AI returned invalid JSON", 502);
    }

    const result = intentSchema.safeParse(parsed);
    if (!result.success) throw new AppError("The AI response did not match the expected shape", 502);
    return result.data;
  },
};
