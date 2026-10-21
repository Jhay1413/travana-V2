import { londonDayKey } from "@/lib/london-day";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The date part of a travel date; tolerates a full ISO string. */
export function dayKeyOf(iso: string): string {
  return iso.slice(0, 10);
}

function utcOf(key: string): Date {
  const [y, m, d] = dayKeyOf(key).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "Sat 17 Oct" */
export function formatTravelDate(iso: string): string {
  const d = utcOf(iso);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

/** "Sat" and "17" for the dashboard date tile. */
export function dateTileParts(iso: string): { day: string; num: string } {
  const d = utcOf(iso);
  return { day: DOW[d.getUTCDay()] ?? "", num: String(d.getUTCDate()) };
}

/** Whole days from `todayKey` to the date (negative once it has passed). */
export function daysAway(iso: string, todayKey: string): number {
  return Math.round((utcOf(iso).getTime() - utcOf(todayKey).getTime()) / 86_400_000);
}

/** "Today" / "Tomorrow" / "In N days". Past dates read as Today. */
export function dayLabel(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** Leaving within `limit` days and not yet done. */
export function isSoon(days: number, done: boolean, limit = 3): boolean {
  return !done && days <= limit;
}

/** London day key for now. */
export function todayKey(now: Date = new Date()): string {
  return londonDayKey(now);
}

const CLOCK = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "Today, 14:05" / "Yesterday, 09:12" / "Thu 15 Oct, 16:20" in London. */
export function formatChangeTime(atIso: string, now: Date = new Date()): string {
  const at = new Date(atIso);
  if (Number.isNaN(at.getTime())) return "";
  const key = londonDayKey(at);
  const diff = daysAway(key, londonDayKey(now));
  const clock = CLOCK.format(at);
  if (diff === 0) return `Today, ${clock}`;
  if (diff === -1) return `Yesterday, ${clock}`;
  return `${formatTravelDate(key)}, ${clock}`;
}

const LONG = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** "Tuesday 20 October 2026" in London. */
export function londonLongDate(d: Date = new Date()): string {
  const p: Record<string, string> = {};
  for (const x of LONG.formatToParts(d)) if (x.type !== "literal") p[x.type] = x.value;
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** The day key `days` after `key` (YYYY-MM-DD). */
export function addDays(key: string, days: number): string {
  const [y, m, d] = dayKeyOf(key).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
