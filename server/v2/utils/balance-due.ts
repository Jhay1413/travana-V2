/**
 * Placeholder carried over from the original SMS reminder. The customer balance-due rule is undecided (owner,
 * 24 Nov 2026); do not derive it from org_tour_operator.balance_due_weeks, which is the agency's own payment term
 * to the operator.
 */
export const PLACEHOLDER_BALANCE_DUE_DAYS_BEFORE_DEPARTURE = 14;

const DAY_MS = 86_400_000;
export const UK_TIMEZONE = "Europe/London";

function parseDay(value: unknown): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ""));
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

/** YYYY-MM-DD of the placeholder customer balance due date (departure minus 14 days), or null without a departure date. */
export function placeholderBalanceDueDate(travelDate: unknown): string | null {
  const dep = parseDay(travelDate);
  if (dep === null) return null;
  return new Date(dep - PLACEHOLDER_BALANCE_DUE_DAYS_BEFORE_DEPARTURE * DAY_MS).toISOString().slice(0, 10);
}

/** "1 Jun 2027" for a YYYY-MM-DD calendar day, in Europe/London (a date that is not YYYY-MM-DD is returned as is). */
export function formatUkDate(value: unknown): string {
  if (!value) return "";
  const day = parseDay(value);
  if (day === null) return String(value);
  // Midday UTC is the same calendar day in London all year, whatever the machine's own zone.
  return new Date(day + 12 * 3_600_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: UK_TIMEZONE });
}
