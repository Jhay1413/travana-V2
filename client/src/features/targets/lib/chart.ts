/** Round chart ceiling: the next £500 (or £5,000 for big numbers) above the biggest bar or target. */
export function niceMax(...series: Array<readonly number[]>): number {
  const m = Math.max(1, ...series.flat());
  const step = m > 10000 ? 5000 : 500;
  return Math.ceil(m / step) * step;
}

export type BarTone = "met" | "missed";

/** Green when the month's profit reached its target, red when it fell short. */
export const barTone = (actual: number, target: number): BarTone => (actual >= target ? "met" : "missed");

export type MonthCell = { kind: "future" } | { kind: "current" } | { kind: "past"; diff: number };

/**
 * What the "Difference" row shows for a month: nothing for months to come, "to date" for the current
 * one (only while the year is under way: `toDate` is 0 otherwise), and plus or minus against the month's
 * target for completed months.
 */
export function monthCell(index: number, currentMonth: number, actual: number, target: number, toDate: number = currentMonth): MonthCell {
  if (index >= currentMonth) return { kind: "future" };
  if (index === toDate - 1) return { kind: "current" };
  return { kind: "past", diff: actual - target };
}

/** Shop swatch colours, assigned by position so a shop keeps its colour across tabs. */
export const SHOP_SWATCHES = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-cyan-500", "bg-amber-500", "bg-fuchsia-500"] as const;
export const HOMEWORKER_SWATCH = "bg-rose-500";

export const shopSwatch = (index: number): string => SHOP_SWATCHES[index % SHOP_SWATCHES.length];
