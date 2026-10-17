export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface CalendarCell {
  iso: string;
  day: number;
  inMonth: boolean;
}

const pad = (n: number): string => String(n).padStart(2, "0");

function parseYmd(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

function toIso(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** "YYYY-MM" of a "YYYY-MM-DD..." string. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Move a "YYYY-MM" by whole months. */
export function shiftMonth(ym: string, by: number): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function monthTitle(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function addDays(iso: string, n: number): string {
  const { y, m, d } = parseYmd(iso);
  return toIso(new Date(Date.UTC(y, m - 1, d + n)));
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const { y, m, d } = parseYmd(iso);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(iso.slice(0, 10), -((dow + 6) % 7));
}

/** Monday-first grid of whole weeks covering the month. */
export function buildMonthCells(ym: string): CalendarCell[] {
  const [y, m] = ym.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const start = weekStart(`${ym}-01`);
  const end = addDays(weekStart(`${ym}-${pad(daysInMonth)}`), 6);
  const cells: CalendarCell[] = [];
  for (let iso = start; iso <= end; iso = addDays(iso, 1)) {
    cells.push({ iso, day: parseYmd(iso).d, inMonth: monthOf(iso) === ym });
  }
  return cells;
}

export function buildWeekCells(weekStartIso: string): CalendarCell[] {
  const month = monthOf(weekStartIso);
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDays(weekStartIso, i);
    return { iso, day: parseYmd(iso).d, inMonth: monthOf(iso) === month };
  });
}

/** Group items by the "YYYY-MM-DD" day returned by `getIso`; items without one are dropped. */
export function groupByDay<T>(items: readonly T[], getIso: (item: T) => string | null | undefined): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const iso = getIso(item);
    if (!iso) continue;
    const key = iso.slice(0, 10);
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

/** "13 to 19 Oct 2026" or "28 Sep to 4 Oct 2026" (year shown on the end date). */
export function weekRangeTitle(weekStartIso: string): string {
  const start = parseYmd(weekStartIso);
  const end = parseYmd(addDays(weekStartIso, 6));
  const startMon = MONTHS[start.m - 1].slice(0, 3);
  const endMon = MONTHS[end.m - 1].slice(0, 3);
  if (start.m === end.m && start.y === end.y) return `${start.d} to ${end.d} ${endMon} ${end.y}`;
  if (start.y === end.y) return `${start.d} ${startMon} to ${end.d} ${endMon} ${end.y}`;
  return `${start.d} ${startMon} ${start.y} to ${end.d} ${endMon} ${end.y}`;
}

/**
 * Move a scheduled post to another day keeping its local time of day.
 * Returns a local wall-clock "YYYY-MM-DDTHH:mm" string.
 */
export function moveKeepingTime(postScheduleIso: string, targetYmd: string): string {
  const at = new Date(postScheduleIso);
  return `${targetYmd.slice(0, 10)}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}
