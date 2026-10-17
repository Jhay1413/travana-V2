import { addDaysToKey, londonDayKey, londonDayStart, londonWeekStartKey } from "@/lib/london-day";

export type TaskRangeFilter = "all" | "today" | "tomorrow" | "this-week" | "custom" | "overdue";

export interface DateRange {
  start: Date;
  end: Date;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Half-open [start, end) range of `days` London days beginning at `startKey`. */
function dayRange(startKey: string, days: number): DateRange {
  return { start: londonDayStart(startKey), end: londonDayStart(addDaysToKey(startKey, days)) };
}

/**
 * Due-date window for a Tasks filter, on Europe/London calendar days (the zone the
 * server uses for "due today"). "all" and "overdue" return an unbounded window: the
 * overdue list has its own query. "this-week" runs from Monday 00:00 London.
 */
export function taskDueRange(filter: TaskRangeFilter, now: Date, customKey: string): DateRange {
  const todayKey = londonDayKey(now);
  switch (filter) {
    case "all":
    case "overdue":
      return { start: new Date(0), end: new Date(Date.UTC(2100, 0, 1)) };
    case "today":
      return dayRange(todayKey, 1);
    case "tomorrow":
      return dayRange(addDaysToKey(todayKey, 1), 1);
    case "this-week":
      return dayRange(londonWeekStartKey(todayKey), 7);
    case "custom":
      return dayRange(DAY_KEY.test(customKey) ? customKey : todayKey, 1);
  }
}
