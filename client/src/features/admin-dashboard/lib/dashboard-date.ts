const LONDON = "Europe/London";

function parts(d: Date, opts: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-GB", { timeZone: LONDON, ...opts }).formatToParts(d)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/** "Saturday 17 October 2026" in London. */
export function londonLongDate(d: Date): string {
  const p = parts(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "Friday 16 October" in London. */
export function londonDayMonth(d: Date): string {
  const p = parts(d, { weekday: "long", day: "numeric", month: "long" });
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Friday" in London. */
export function londonWeekday(d: Date): string {
  return parts(d, { weekday: "long" }).weekday ?? "";
}

const TIME_RE = /^(\d{1,2}):(\d{2})(am|pm)$/i;

/** Minutes after midnight for "8:00am"; null when the text is not a time. */
export function timeToMinutes(time: string): number | null {
  const m = TIME_RE.exec(time.trim());
  if (!m) return null;
  const hour12 = Number(m[1]) % 12;
  return (hour12 + (m[3].toLowerCase() === "pm" ? 12 : 0)) * 60 + Number(m[2]);
}

const UTC_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

function isWeekday(d: Date): boolean {
  return d.getUTCDay() !== 0 && d.getUTCDay() !== 6;
}

/**
 * "Next briefing: Monday 19 October at 8:00am, in the app and by email." The briefing goes out on
 * London weekdays, so this is the next one strictly after `now`.
 */
export function nextBriefingText(now: Date, time: string, email: boolean): string {
  const target = timeToMinutes(time) ?? 8 * 60;
  const p = parts(now, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" });
  const nowMinutes = Number(p.hour) * 60 + Number(p.minute);
  let day = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  if (!(isWeekday(day) && target > nowMinutes)) {
    do {
      day = new Date(day.getTime() + 86_400_000);
    } while (!isWeekday(day));
  }
  const dp: Record<string, string> = {};
  for (const x of UTC_DAY.formatToParts(day)) if (x.type !== "literal") dp[x.type] = x.value;
  return `Next briefing: ${dp.weekday} ${dp.day} ${dp.month} at ${time}${email ? ", in the app and by email." : ", in the app."}`;
}

/** "9:05am" in London, 12-hour with lower-case am/pm to match the send-time options. */
export function londonClock(d: Date): string {
  const p = parts(d, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${p.hour}:${p.minute}${(p.dayPeriod ?? "").toLowerCase()}`;
}
