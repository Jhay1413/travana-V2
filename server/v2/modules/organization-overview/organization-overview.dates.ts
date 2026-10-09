import { toUkWallClock, ukLocalToUtc } from "../../utils/uk-time";

// Europe/London calendar boundaries as UTC instants. The server may run in UTC
// while the business reports in UK time (BST = UTC+1), so server-local Date
// arithmetic would put "today" / "this month" an hour out for ~7 months a year.

/** London midnight of the given London calendar date (month 1-12; day/month may overflow). */
function ukMidnight(year: number, month: number, day: number): Date {
  return ukLocalToUtc({ year, month, day, hour: 0, minute: 0, second: 0 });
}

export function ukStartOfDay(d: Date): Date {
  const w = toUkWallClock(d);
  return ukMidnight(w.year, w.month, w.day);
}

/** Monday 00:00 London of the week containing `d`. */
export function ukStartOfWeek(d: Date): Date {
  const w = toUkWallClock(d);
  const dow = new Date(Date.UTC(w.year, w.month - 1, w.day)).getUTCDay() || 7;
  return ukMidnight(w.year, w.month, w.day - (dow - 1));
}

export function ukStartOfMonth(d: Date): Date {
  const w = toUkWallClock(d);
  return ukMidnight(w.year, w.month, 1);
}

/** Exclusive end of the London month containing `d` (= start of next month). */
export function ukMonthEnd(d: Date): Date {
  const w = toUkWallClock(d);
  return ukMidnight(w.year, w.month + 1, 1);
}

export function ukStartOfYear(d: Date): Date {
  const w = toUkWallClock(d);
  return ukMidnight(w.year, 1, 1);
}

export function ukStartOfNextYear(d: Date): Date {
  const w = toUkWallClock(d);
  return ukMidnight(w.year + 1, 1, 1);
}

/** Adds London calendar days, keeping the London wall-clock time of day. */
export function ukAddDays(d: Date, days: number): Date {
  const w = toUkWallClock(d);
  return ukLocalToUtc({ ...w, day: w.day + days });
}

/** London calendar date as YYYY-MM-DD (for DATE columns). */
export function ukDateString(d: Date): string {
  const w = toUkWallClock(d);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** London calendar year and month (1-12) of the instant. */
export function ukYearMonth(d: Date): { year: number; month: number } {
  const w = toUkWallClock(d);
  return { year: w.year, month: w.month };
}

/** Full London month name, e.g. "October". */
export function ukMonthName(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "long" }).format(d);
}
