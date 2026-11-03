import { dayName, formatClock } from "./snooze";

export type DayGroupKey = "today" | "yesterday" | "earlier";
export interface DayGroup<T> {
  key: DayGroupKey;
  label: "TODAY" | "YESTERDAY" | "EARLIER";
  rows: T[];
}

const LABELS: Record<DayGroupKey, DayGroup<unknown>["label"]> = {
  today: "TODAY",
  yesterday: "YESTERDAY",
  earlier: "EARLIER",
};
const ORDER: DayGroupKey[] = ["today", "yesterday", "earlier"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between `iso` and `now` (0 = today); unparseable counts as far past. */
function daysAgo(iso: string, now: Date): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.round((startOfDay(now) - startOfDay(new Date(t))) / 86_400_000);
}

/** Buckets rows into today / yesterday / earlier, omitting empty groups. */
export function groupRows<T>(rows: T[], getIso: (r: T) => string, now: Date): DayGroup<T>[] {
  const buckets: Record<DayGroupKey, T[]> = { today: [], yesterday: [], earlier: [] };
  for (const row of rows) {
    const d = daysAgo(getIso(row), now);
    buckets[d <= 0 ? "today" : d === 1 ? "yesterday" : "earlier"].push(row);
  }
  return ORDER.filter((k) => buckets[k].length > 0).map((k) => ({
    key: k,
    label: LABELS[k] as DayGroup<T>["label"],
    rows: buckets[k],
  }));
}

/** "10:42" today, "Yesterday", "Mon" within 6 days, else "12 Oct". */
export function formatRowTime(iso: string, now: Date): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const d = daysAgo(iso, now);
  if (d <= 0) return formatClock(t);
  if (d === 1) return "Yesterday";
  if (d <= 6) return dayName(t);
  return `${t.getDate()} ${MONTHS[t.getMonth()]}`;
}
