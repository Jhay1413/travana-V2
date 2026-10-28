import type { QuoteVariableMapping, QuoteVariableSource } from "../types";

const PLACEHOLDER = /\{\{\s*(\d+)\s*\}\}/g;

/** Placeholder numbers in the body, in first-seen order, deduped: "Hi {{1}} {{2}} {{1}}" -> ["1","2"]. */
export function extractPlaceholders(body: string): string[] {
  const seen: string[] = [];
  for (const m of body.matchAll(PLACEHOLDER)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

/** Numbers missing from 1..max, e.g. ["1","3"] -> ["2"]. Meta requires sequential placeholders. */
export function placeholderGaps(placeholders: string[]): string[] {
  const nums = placeholders.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  const gaps: string[] = [];
  for (let i = 1; i <= max; i++) if (!nums.includes(i)) gaps.push(String(i));
  return gaps;
}

/** True when two placeholders touch with nothing between them, e.g. "{{1}}{{2}}". */
export function hasConsecutivePlaceholders(body: string): boolean {
  return /\{\{\s*\d+\s*\}\}\s*\{\{\s*\d+\s*\}\}/.test(body);
}

/** True when the body starts or ends with a placeholder (Meta rejects this). */
export function placeholderAtEdge(body: string): boolean {
  const t = body.trim();
  return /^\{\{\s*\d+\s*\}\}/.test(t) || /\{\{\s*\d+\s*\}\}$/.test(t);
}

/** First problem with a new template body, or null when it looks submittable. */
export function bodyProblem(body: string): string | null {
  if (!body.trim()) return "Body is required.";
  const gaps = placeholderGaps(extractPlaceholders(body));
  if (gaps.length > 0) return `Placeholders must be numbered in order. Missing {{${gaps[0]}}}.`;
  if (hasConsecutivePlaceholders(body)) return "Two placeholders can't sit next to each other. Put some text between them.";
  if (placeholderAtEdge(body)) return "The body can't start or end with a placeholder.";
  return null;
}

const SOURCE_EXAMPLE: Record<Exclude<QuoteVariableSource, "custom">, string> = {
  client_first_name: "Sam",
  agent_name: "Alex",
  agency_name: "Travana Travel",
  quote_link: "https://…/q/abc",
};

/** Default mapping: {{1}} client name, last of 2+ the quote link, everything else fixed text. */
export function defaultMapping(index: number, total: number): QuoteVariableMapping {
  if (index === 0) return { source: "client_first_name" };
  if (total >= 2 && index === total - 1) return { source: "quote_link" };
  return { source: "custom", text: "" };
}

/** Existing mapping for each placeholder, defaulting the unmapped ones. */
export function resolveMappings(
  placeholders: string[],
  saved: Record<string, QuoteVariableMapping> | undefined,
): Record<string, QuoteVariableMapping> {
  const out: Record<string, QuoteVariableMapping> = {};
  placeholders.forEach((p, i) => {
    out[p] = saved?.[p] ?? defaultMapping(i, placeholders.length);
  });
  return out;
}

/** Every fixed-text row must have text. */
export function mappingsComplete(mappings: Record<string, QuoteVariableMapping>): boolean {
  return Object.values(mappings).every((m) => m.source !== "custom" || (m.text ?? "").trim().length > 0);
}

/** Body with each placeholder swapped for example text (or the fixed text). */
export function renderPreview(body: string, mappings: Record<string, QuoteVariableMapping>): string {
  return body.replace(PLACEHOLDER, (whole, n: string) => {
    const m = mappings[n];
    if (!m) return whole;
    if (m.source === "custom") return (m.text ?? "").trim() || "…";
    return SOURCE_EXAMPLE[m.source];
  });
}
