/** The largest yearly (or monthly) target a box accepts, in whole pounds. */
export const MAX_TARGET = 50_000_000;

export type MoneyResult = { ok: true; value: number } | { ok: false; error: string };

/** "£90,000", "90 000" or "90000" -> 90000. Whole pounds only. */
export function parseMoney(raw: string): MoneyResult {
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (cleaned === "") return { ok: false, error: "Enter an amount" };
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: "Enter a whole number of pounds" };
  const value = Number(cleaned);
  if (value > MAX_TARGET) return { ok: false, error: "That is more than we can handle. Check the amount" };
  return { ok: true, value };
}

/** 90000 -> "90,000" (for the text in a box). */
export const moneyText = (n: number): string => n.toLocaleString("en-GB");

/** 90000 -> "£90,000"; negatives read "-£500". */
export const gbp = (n: number): string => `${n < 0 ? "-" : ""}£${Math.abs(Math.round(n)).toLocaleString("en-GB")}`;

/** Chart axis label: 8000 -> "£8k", 1500 -> "£1.5k", 500 -> "£500". */
export function shortGbp(n: number): string {
  if (n >= 1000) return `£${Number((n / 1000).toFixed(1))}k`;
  return `£${Math.round(n)}`;
}
