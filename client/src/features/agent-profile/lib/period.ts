import { MONTH_NAMES, addDays, daysInMonth, makeKey, monthKeyOf, parseKey, weekdayIndex } from "./dates";

export type PeriodGroup = "timeframe" | "quarter" | "month";

export interface PeriodOption {
  key: string;
  /** Text in the "Show" drop-down. */
  label: string;
  /** Reads after "Showing Tina's figures for ...". */
  say: string;
  /** London calendar days, half-open: [from, to). */
  from: string;
  to: string;
  group: PeriodGroup;
}

export const DEFAULT_PERIOD_KEY = "month";

/** The three buttons beside the drop-down; each key is also a drop-down option. */
export const QUICK_PERIOD_KEYS = ["today", "week", "month"] as const;

export const PERIOD_GROUP_LABEL: Record<PeriodGroup, string> = {
  timeframe: "Timeframes",
  quarter: "Quarters",
  month: "Months",
};

function mondayOf(key: string): string {
  return addDays(key, -weekdayIndex(key));
}

function firstOfMonth(year: number, month: number): string {
  return makeKey(year, month, 1);
}

/**
 * Every period the profile can show, resolved to London day bounds for `todayKey`.
 * "This week" and "This month" are whole calendar periods; the rolling ones
 * (last 30 days, year to date) end tomorrow so today is included.
 */
export function buildPeriods(todayKey: string): PeriodOption[] {
  const today = parseKey(todayKey);
  const tomorrow = addDays(todayKey, 1);
  const monday = mondayOf(todayKey);
  const thisMonth = firstOfMonth(today.year, today.month);
  const nextMonth = firstOfMonth(today.year, today.month + 1);
  const lastMonth = firstOfMonth(today.year, today.month - 1);

  const list: PeriodOption[] = [
    { key: "today", label: "Today", say: "today", from: todayKey, to: tomorrow, group: "timeframe" },
    { key: "week", label: "This week", say: "this week", from: monday, to: addDays(monday, 7), group: "timeframe" },
    { key: "lastweek", label: "Last week", say: "last week", from: addDays(monday, -7), to: monday, group: "timeframe" },
    { key: "month", label: "This month", say: "this month", from: thisMonth, to: nextMonth, group: "timeframe" },
    { key: "lastmonth", label: "Last month", say: "last month", from: lastMonth, to: thisMonth, group: "timeframe" },
    { key: "last30", label: "Last 30 days", say: "the last 30 days", from: addDays(todayKey, -29), to: tomorrow, group: "timeframe" },
    { key: "ytd", label: "Year to date", say: `the year so far, ${today.year}`, from: firstOfMonth(today.year, 1), to: tomorrow, group: "timeframe" },
  ];

  for (let q = 1; q <= 4; q++) {
    const startMonth = (q - 1) * 3 + 1;
    const from = firstOfMonth(today.year, startMonth);
    if (from > todayKey) break;
    const span = `${MONTH_NAMES[startMonth - 1]} to ${MONTH_NAMES[startMonth + 1]} ${today.year}`;
    list.push({ key: `q${q}`, label: `Q${q} (${span})`, say: span, from, to: firstOfMonth(today.year, startMonth + 3), group: "quarter" });
  }

  for (let m = 1; m <= today.month; m++) {
    const name = `${MONTH_NAMES[m - 1]} ${today.year}`;
    list.push({ key: monthKeyOf(today.year, m), label: name, say: name, from: firstOfMonth(today.year, m), to: firstOfMonth(today.year, m + 1), group: "month" });
  }
  return list;
}

/** The option for a key, falling back to this month. */
export function findPeriod(periods: PeriodOption[], key: string): PeriodOption {
  return periods.find((p) => p.key === key) ?? periods.find((p) => p.key === DEFAULT_PERIOD_KEY) ?? periods[0];
}

export interface MonthOverlap {
  year: number;
  /** 1 to 12. */
  month: number;
  /** Days of the half-open window that fall in this month. */
  days: number;
  daysInMonth: number;
}

/** The calendar months a half-open window touches, with how many of its days fall in each. */
export function monthsOverlapping(from: string, to: string): MonthOverlap[] {
  const out: MonthOverlap[] = [];
  const start = parseKey(from);
  let year = start.year;
  let month = start.month;
  for (let guard = 0; guard < 60; guard++) {
    const monthStart = firstOfMonth(year, month);
    if (monthStart >= to) break;
    const monthEnd = firstOfMonth(year, month + 1);
    const lo = from > monthStart ? from : monthStart;
    const hi = to < monthEnd ? to : monthEnd;
    const days = Math.round((Date.parse(hi) - Date.parse(lo)) / 86_400_000);
    if (days > 0) out.push({ year, month, days, daysInMonth: daysInMonth(year, month) });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

/** The distinct years a window touches, oldest first. */
export function yearsInWindow(from: string, to: string): number[] {
  return [...new Set(monthsOverlapping(from, to).map((m) => m.year))];
}

/** Month keys (YYYY-MM) a window touches, used to shade the monthly chart. */
export function shadedMonthKeys(from: string, to: string): string[] {
  return monthsOverlapping(from, to).map((m) => monthKeyOf(m.year, m.month));
}
