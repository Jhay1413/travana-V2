import { toUkWallClock, ukLocalToUtc, type UkWallClock } from "../../utils/uk-time";
import { ukAddDays, ukStartOfMonth, ukStartOfWeek, ukStartOfYear } from "../../utils/london-dates";
import type { CompareAgainst, ComparePeriod } from "./organization-overview.types";

export interface CompareDateRange {
  from: Date;
  to: Date;
}

export interface CompareWindows {
  /** `year` is normalised to `prev` for period=year. */
  against: CompareAgainst;
  now: CompareDateRange;
  other: CompareDateRange;
}

const DAYS_IN_WEEK_YEAR = 364; // 52 weeks: keeps the same weekday a year back

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function londonMidnight(year: number, month: number, day: number): Date {
  return ukLocalToUtc({ year, month, day, hour: 0, minute: 0, second: 0 });
}

/**
 * The London wall-clock moment `ref` re-expressed in the given year/month. When
 * that month has no such day (31 Mar vs Feb, 29 Feb vs a non-leap year) the
 * result is clamped to the month's exclusive end (00:00 on the 1st of the next
 * month) so the comparison covers the whole month rather than rolling over.
 * Explicit clamp: ukLocalToUtc uses Date.UTC, which would roll overflow silently.
 */
function sameWallClockIn(year: number, month: number, ref: UkWallClock): Date {
  if (ref.day > daysInMonth(year, month)) return londonMidnight(year, month + 1, 1);
  return ukLocalToUtc({ ...ref, year, month });
}

function normaliseAgainst(period: ComparePeriod, against: CompareAgainst): CompareAgainst {
  return period === "year" && against === "year" ? "prev" : against;
}

/** Like-for-like to-date windows, half-open [from, to), on London wall-clock time. */
export function compareWindows(
  period: ComparePeriod,
  against: CompareAgainst,
  now: Date = new Date(),
): CompareWindows {
  const normalised = normaliseAgainst(period, against);
  const w = toUkWallClock(now);

  if (period === "week") {
    const weekStart = ukStartOfWeek(now);
    const back = normalised === "year" ? DAYS_IN_WEEK_YEAR : 7;
    return {
      against: normalised,
      now: { from: weekStart, to: now },
      other: { from: ukAddDays(weekStart, -back), to: ukAddDays(now, -back) },
    };
  }

  if (period === "month") {
    const prevMonth = w.month === 1 ? { year: w.year - 1, month: 12 } : { year: w.year, month: w.month - 1 };
    const target = normalised === "year" ? { year: w.year - 1, month: w.month } : prevMonth;
    return {
      against: normalised,
      now: { from: ukStartOfMonth(now), to: now },
      other: {
        from: londonMidnight(target.year, target.month, 1),
        to: sameWallClockIn(target.year, target.month, w),
      },
    };
  }

  const yearsBack = normalised === "two_years" ? 2 : 1;
  const targetYear = w.year - yearsBack;
  return {
    against: normalised,
    now: { from: ukStartOfYear(now), to: now },
    other: {
      from: londonMidnight(targetYear, 1, 1),
      to: sameWallClockIn(targetYear, w.month, w),
    },
  };
}

export function compareLabels(period: ComparePeriod, against: CompareAgainst): { now: string; other: string } {
  const normalised = normaliseAgainst(period, against);
  if (period === "week") {
    return {
      now: "This week so far",
      other: normalised === "year" ? "Same week last year" : "Same point last week",
    };
  }
  if (period === "month") {
    return {
      now: "This month so far",
      other: normalised === "year" ? "Same point last year" : "Same point last month",
    };
  }
  return {
    now: "Year to date",
    other: normalised === "two_years" ? "Same point two years ago" : "Same point last year",
  };
}
