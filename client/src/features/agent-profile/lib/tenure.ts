import { dayKeyOf, daysBetween, formatDay, parseKey } from "./dates";
import { plural } from "./money";

/** "2 years, 3 months", "5 months" or "12 days": how long since `startKey` as of `todayKey`. */
export function tenureText(startKey: string, todayKey: string): string {
  const s = parseKey(startKey);
  const t = parseKey(todayKey);
  if (daysBetween(startKey, todayKey) < 0) return "not started yet";
  let months = (t.year - s.year) * 12 + (t.month - s.month);
  if (t.day < s.day) months -= 1;
  if (months < 1) {
    const days = daysBetween(startKey, todayKey);
    return days === 0 ? "less than a day" : plural(days, "day");
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(plural(years, "year"));
  if (rest > 0) parts.push(plural(rest, "month"));
  return parts.join(", ");
}

/** "Started 12 Mar 2024 · 2 years, 7 months with Tinas Travel Deals". */
export function startedLine(startedAt: string, todayKey: string, organisationName: string): string {
  const start = dayKeyOf(startedAt);
  const org = organisationName ? ` with ${organisationName}` : "";
  const future = daysBetween(start, todayKey) < 0;
  if (future) return `Starts ${formatDay(start)}${org}`;
  return `Started ${formatDay(start)} · ${tenureText(start, todayKey)}${org}`;
}
