const LONDON_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

/** Calendar day (YYYY-MM-DD) of an instant in the Europe/London zone, matching the server's "due today". */
export function londonDayKey(d: Date): string {
  return LONDON_DAY.format(d);
}

/** The London day key `days` after the given key. */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isSameLondonDay(a: Date, b: Date): boolean {
  return londonDayKey(a) === londonDayKey(b);
}

export function isLondonTomorrow(d: Date, now: Date): boolean {
  return londonDayKey(d) === addDaysToKey(londonDayKey(now), 1);
}

const LONDON_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Milliseconds London is ahead of UTC at the given instant (0 in winter, 3,600,000 in BST). */
function londonOffsetMs(instant: number): number {
  const parts: Record<string, number> = {};
  for (const p of LONDON_PARTS.formatToParts(new Date(instant))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The UTC instant at which the London calendar day `key` (YYYY-MM-DD) begins. DST-safe. */
export function londonDayStart(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d);
  const first = naive - londonOffsetMs(naive);
  return new Date(naive - londonOffsetMs(first));
}

/** Monday (YYYY-MM-DD) of the London week containing the given day key. */
export function londonWeekStartKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysToKey(key, -((dow + 6) % 7));
}

/** The London calendar year and month (1-12) of an instant. */
export function londonYearMonth(d: Date): { year: number; month: number } {
  const [year, month] = londonDayKey(d).split("-").map(Number);
  return { year, month };
}
