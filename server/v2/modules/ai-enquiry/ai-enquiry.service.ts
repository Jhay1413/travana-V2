import OpenAI from "openai";
import { CHAT_MODEL } from "../../utils/ai-model";
import { z } from "zod";
import { AppError } from "../../utils/error-handler";
import type { EnquiryIntent } from "./ai-enquiry.types";

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AppError("OpenAI API key is not configured", 503);
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Validation for the model's JSON so a malformed field can't break the client.
// Everything is coerced to a safe default rather than rejected.
const intentSchema = z.object({
  enquiryTitle: z.string().default(""),
  holidayType: z.string().default(""),
  countries: z.array(z.string()).default([]),
  destinations: z.array(z.string()).default([]),
  resorts: z.array(z.string()).default([]),
  departureAirports: z.array(z.string()).default([]),
  boardBasis: z.array(z.string()).default([]),
  starRating: z.string().default(""),
  travelDate: z.string().default(""),
  flexibility: z.string().default(""),
  nights: z.number().nullable().default(null),
  adults: z.number().default(2),
  children: z.number().default(0),
  infants: z.number().default(0),
  childAges: z.array(z.number()).default([]),
  budget: z.union([z.string(), z.number()]).transform((v) => String(v ?? "")).default(""),
  budgetType: z.string().default("Per Person"),
  notes: z.string().default(""),
  confidence: z.enum(["low", "medium", "high"]).default("low"),
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

export const aiEnquiryService = {
  // Extracts a structured enquiry intent from a conversation transcript.
  async fromTranscript(transcript: string): Promise<EnquiryIntent> {
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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Conversation transcript:\n\n${clipped}` },
        ],
      });
      raw = response.choices[0]?.message?.content?.trim();
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
