import { ukYearMonth } from "./london-dates";

export type OpeningPattern = "mon-fri" | "mon-sat" | "seven-days";

export interface LeaveSpan {
  type: string;
  status: string;
  /** Inclusive YYYY-MM-DD bounds (hr_leaves date columns). */
  from: string;
  to: string;
}

const DAY_MS = 86_400_000;
const MAX_SPAN_DAYS = 5 * 366;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Narrows a stored branch opening pattern; anything unknown (or unset) is Monday to Friday. */
export function toOpeningPattern(value: string | null | undefined): OpeningPattern {
  return value === "mon-sat" || value === "seven-days" ? value : "mon-fri";
}

/** dayOfWeek: 0 = Sunday ... 6 = Saturday. */
export function isWorkingDayOfWeek(dayOfWeek: number, pattern: OpeningPattern): boolean {
  if (pattern === "seven-days") return true;
  if (pattern === "mon-sat") return dayOfWeek !== 0;
  return dayOfWeek >= 1 && dayOfWeek <= 5;
}

function utcMs(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`);
}

/**
 * Working days (by the branch opening pattern) in the inclusive date range [from, to],
 * optionally clipped to [clipFrom, clipTo]. Malformed or inverted ranges count 0; spans over 5 years are capped.
 */
export function countWorkingDays(
  from: string,
  to: string,
  pattern: OpeningPattern,
  clip?: { from: string; to: string },
): number {
  if (!YMD.test(from) || !YMD.test(to)) return 0;
  let start = utcMs(from);
  let end = utcMs(to);
  if (clip) {
    start = Math.max(start, utcMs(clip.from));
    end = Math.min(end, utcMs(clip.to));
  }
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  // Guard against absurd ranges (bad data) even without a clip window.
  if ((end - start) / DAY_MS > MAX_SPAN_DAYS) end = start + MAX_SPAN_DAYS * DAY_MS;
  let days = 0;
  for (let t = start; t <= end; t += DAY_MS) {
    if (isWorkingDayOfWeek(new Date(t).getUTCDay(), pattern)) days += 1;
  }
  return days;
}

/**
 * Approved Annual leave in working days that fall inside the given calendar year.
 * Shared by the HR page and the agent profile so both show the same "used" figure.
 */
export function holidayWorkingDaysInYear(leaves: LeaveSpan[], year: number, pattern: OpeningPattern): number {
  const clip = { from: `${year}-01-01`, to: `${year}-12-31` };
  return leaves
    .filter((l) => l.status === "Approved" && l.type === "Annual")
    .reduce((total, l) => total + countWorkingDays(l.from, l.to, pattern, clip), 0);
}

/** The current London calendar year. */
export function currentLondonYear(now: Date = new Date()): number {
  return ukYearMonth(now).year;
}
