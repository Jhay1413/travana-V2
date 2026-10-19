import { londonDayKey } from "@/lib/london-day";

// Calendar helpers on YYYY-MM-DD keys. Keys are plain London calendar days, so every
// calculation here runs in UTC on the key and never depends on the browser's zone.

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** Monday first, matching the week planner and the leave calendar. */
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface DayParts {
  year: number;
  month: number;
  day: number;
}

/** First ten characters of an ISO date or timestamp. */
export function dayOf(value: string): string {
  return value.slice(0, 10);
}

export function parseKey(key: string): DayParts {
  const [year, month, day] = dayOf(key).split("-").map(Number);
  return { year, month, day };
}

export function makeKey(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const p = parseKey(key);
  return makeKey(p.year, p.month, p.day + days);
}

/** Whole days from a to b (b later gives a positive number). */
export function daysBetween(a: string, b: string): number {
  const pa = parseKey(a);
  const pb = parseKey(b);
  return Math.round((Date.UTC(pb.year, pb.month - 1, pb.day) - Date.UTC(pa.year, pa.month - 1, pa.day)) / 86_400_000);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Monday ... 6 = Sunday. */
export function weekdayIndex(key: string): number {
  const p = parseKey(key);
  return (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
}

export function monthKeyOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "12 Oct 2026". */
export function formatDay(key: string): string {
  const p = parseKey(key);
  return `${p.day} ${MONTH_SHORT[p.month - 1]} ${p.year}`;
}

/** "Thursday 15 October". */
export function formatDayLong(key: string): string {
  const p = parseKey(key);
  return `${WEEKDAY_NAMES[weekdayIndex(key)]} ${p.day} ${MONTH_NAMES[p.month - 1]}`;
}

/** "12 Oct" to "14 Oct 2026" style range, collapsing a single day. */
export function formatRange(from: string, to: string): string {
  const a = dayOf(from);
  const b = dayOf(to);
  if (a === b) return formatDay(a);
  const pa = parseKey(a);
  const pb = parseKey(b);
  if (pa.year === pb.year) return `${pa.day} ${MONTH_SHORT[pa.month - 1]} to ${formatDay(b)}`;
  return `${formatDay(a)} to ${formatDay(b)}`;
}

const LONDON_CLOCK = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * "14:30" for an instant in London time, or null for a date-only value. Date-only tasks are stored at
 * midnight, either London midnight or UTC midnight (01:00 in summer), so both read as "no time".
 */
export function londonClock(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return null;
  const text = LONDON_CLOCK.format(d);
  return text === "00:00" ? null : text;
}

/** The London calendar day (YYYY-MM-DD) of a timestamp. */
export function londonDayOfInstant(iso: string): string {
  return londonDayKey(new Date(iso));
}

/** A plain 10-character date is kept as is; anything longer is a timestamp and becomes its London day. */
export function dayKeyOf(value: string): string {
  return /^d{4}-d{2}-d{2}$/.test(value) ? value : londonDayOfInstant(value);
}
