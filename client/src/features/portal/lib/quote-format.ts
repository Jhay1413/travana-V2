/** Formatting for the portal's quote screens. */

/** The line under a confirmed booking's price: nothing is left to check, so no availability caveat. */
export const PRICE_INCLUDES_LINE = "Prices include all applicable taxes and fees.";

/** The line under a quote's price (it is not confirmed until booked). */
export const PRICE_DISCLAIMER = `${PRICE_INCLUDES_LINE} Subject to availability.`;

/** Money as the rest of the portal shows it. */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

/**
 * "1 Dec 2026" from an ISO date or date-time, read as written (no time-zone shift), the way the quote has always
 * been shown. Returns "" for nothing or a value that is not a date.
 */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "";
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "09:30" from an ISO date-time, read as written; "" when the value has no time. */
export function formatClock(value: string | null | undefined): string {
  if (!value) return "";
  const match = /T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : "";
}

/** "1 Dec 2026 to 8 Dec 2026"; just the start when there is no end; "" when there is neither. */
export function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = formatDay(start);
  const b = formatDay(end);
  if (a && b) return `${a} to ${b}`;
  return a || b;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2 adults, 1 child, 1 infant" (zero counts left out). */
export function paxLabel(adults: number, children: number, infants = 0): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(plural(adults, "adult"));
  if (children > 0) parts.push(plural(children, "child", "children"));
  if (infants > 0) parts.push(plural(infants, "infant"));
  return parts.join(", ");
}

/** "7 nights · All Inclusive · 2 adults": the small line under a quote's dates, leaving out what is not known. */
export function factsLine(nights: number | null, board: string | null, pax: string): string {
  return [nights ? plural(nights, "night") : "", board ?? "", pax].filter(Boolean).join(" · ");
}

const ROMAN: ReadonlyArray<[number, string]> = [
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** Roman numeral for the numbered lists (I, II, III ...); plain digits past 39. */
export function toRoman(n: number): string {
  if (n < 1 || n > 39) return String(n);
  let rest = n;
  let out = "";
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

/** The generic name the server uses when a deal has no agent. */
const GENERIC_AGENT = "Your Travel Agent";

/** The agent's first name for sentences such as "Tell Sam"; `fallback` when there is no real name. */
export function agentFirstName(name: string | null | undefined, fallback = "your agent"): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed === GENERIC_AGENT) return fallback;
  return trimmed.split(/\s+/)[0];
}

/** The names with blanks and repeats removed, in first-seen order ("Hotel A, Hotel A" becomes "Hotel A"). */
export function uniqueNames(names: ReadonlyArray<string | null | undefined>): string[] {
  return Array.from(new Set(names.map((n) => (n ?? "").trim()).filter(Boolean)));
}
