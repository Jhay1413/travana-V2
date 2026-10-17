// Europe/London calendar-window boundaries, returned as UTC instants. Built on
// the single London date implementation in london-dates.ts.
import { ukAddDays, ukMonthEnd, ukStartOfDay, ukStartOfMonth, ukStartOfWeek } from "./london-dates";

export interface LondonWindows {
  /** 00:00 London today. */
  todayStart: Date;
  /** 00:00 London tomorrow (exclusive end of today). */
  tomorrowStart: Date;
  /** 00:00 London yesterday. */
  yesterdayStart: Date;
  /** 00:00 London on the Monday of the current week. */
  weekStart: Date;
  /** 00:00 London on the 1st of the current month. */
  monthStart: Date;
  /** 00:00 London on the 1st of next month (exclusive end of the month). */
  monthEnd: Date;
}

export function getLondonWindows(now: Date = new Date()): LondonWindows {
  const todayStart = ukStartOfDay(now);
  return {
    todayStart,
    // ukAddDays keeps London wall-clock time (00:00), so it is DST-safe.
    tomorrowStart: ukAddDays(todayStart, 1),
    yesterdayStart: ukAddDays(todayStart, -1),
    weekStart: ukStartOfWeek(now),
    monthStart: ukStartOfMonth(now),
    monthEnd: ukMonthEnd(now),
  };
}

export type LondonDayRangeKind = "today" | "yesterday" | "week";

export interface InstantRange {
  /** Inclusive lower bound. */
  from: Date;
  /** Exclusive upper bound; absent = open-ended up to now. */
  to?: Date;
}

/** London-day range as UTC instants: today / yesterday (bounded) / week (Monday to now). */
export function getLondonDayRange(kind: LondonDayRangeKind, now: Date = new Date()): InstantRange {
  const w = getLondonWindows(now);
  if (kind === "today") return { from: w.todayStart };
  if (kind === "yesterday") return { from: w.yesterdayStart, to: w.todayStart };
  return { from: w.weekStart };
}
