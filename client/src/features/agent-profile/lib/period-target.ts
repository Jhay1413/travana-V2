import { monthsOverlapping } from "./period";

/** A year's twelve month targets (January first), by calendar year. A missing year counts as no target. */
export type TargetsByYear = Record<number, readonly number[] | undefined>;

/**
 * The target for any window: each month's target times the share of that month's days the
 * window covers. One rule for every period, so a whole month gives exactly the month target,
 * and a week or a day gets a fair slice of it. Rounded to whole pounds.
 */
export function periodTarget(from: string, to: string, targetsByYear: TargetsByYear): number {
  let total = 0;
  for (const m of monthsOverlapping(from, to)) {
    const monthTarget = targetsByYear[m.year]?.[m.month - 1] ?? 0;
    if (monthTarget > 0) total += (monthTarget * m.days) / m.daysInMonth;
  }
  return Math.round(total);
}
