/**
 * Pure scheduling decisions for the days-before-departure SMS sweep. No I/O, so
 * every rule here is unit tested without a clock, a database or cron.
 */

export const DEPARTURE_SWEEP_ENV_VAR = "SMS_DEPARTURE_SWEEP_ENABLED";
/** Daily at 09:00 in DEPARTURE_SWEEP_TIMEZONE (so it follows UK summer/winter time). */
export const DEPARTURE_SWEEP_CRON = "0 9 * * *";
export const DEPARTURE_SWEEP_TIMEZONE = "Europe/London";

/** Real texts go to real clients, so only the exact string "true" turns the sweep on. */
export function isDepartureSweepEnabled(env: Record<string, string | undefined>): boolean {
  return env[DEPARTURE_SWEEP_ENV_VAR] === "true";
}

interface UkParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const ukFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: DEPARTURE_SWEEP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function ukParts(instant: Date): UkParts {
  const out: Record<string, number> = {};
  for (const part of ukFormatter.formatToParts(instant)) {
    if (part.type !== "literal") out[part.type] = Number(part.value);
  }
  return {
    year: out.year ?? 0,
    month: out.month ?? 0,
    day: out.day ?? 0,
    hour: out.hour ?? 0,
    minute: out.minute ?? 0,
    second: out.second ?? 0,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** The UK calendar date (YYYY-MM-DD) of an instant. */
export function ukDateString(instant: Date): string {
  const p = ukParts(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** YYYY-MM-DD plus whole days (calendar arithmetic, immune to DST). */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + days));
  return shifted.toISOString().slice(0, 10);
}

/** UK offset from UTC in ms at an instant (+1h in summer, 0 in winter). */
function ukOffsetMs(instant: Date): number {
  const p = ukParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant the current UK calendar day began (00:00 UK time). */
export function startOfUkDay(instant: Date): Date {
  const p = ukParts(instant);
  const localMidnightAsUtc = Date.UTC(p.year, p.month - 1, p.day);
  // The offset at midnight can differ from the offset now on a clock-change day, so settle it twice.
  let candidate = localMidnightAsUtc - ukOffsetMs(instant);
  candidate = localMidnightAsUtc - ukOffsetMs(new Date(candidate));
  return new Date(candidate);
}

export interface DepartureSweepTarget {
  daysBefore: number;
  /** booking.travel_date to match, as YYYY-MM-DD (UK calendar). */
  travelDate: string;
}

export interface DepartureSweepPlan {
  /** UK today, YYYY-MM-DD. */
  today: string;
  /** Messages already sent since this instant count as "sent today" (UK midnight). */
  dedupeSince: Date;
  targets: DepartureSweepTarget[];
}

/**
 * What one sweep run covers. Each distinct, valid days-before value maps to exactly
 * one travel date (UK today + n), never a range, so a first run (or a run after
 * downtime) cannot reach back to departures that have already passed. Negative,
 * fractional and missing values are dropped.
 */
export function planDepartureSweep(now: Date, daysBeforeValues: ReadonlyArray<number | null | undefined>): DepartureSweepPlan {
  const today = ukDateString(now);
  const valid = Array.from(
    new Set(daysBeforeValues.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0)),
  ).sort((a, b) => a - b);
  return {
    today,
    dedupeSince: startOfUkDay(now),
    targets: valid.map((daysBefore) => ({ daysBefore, travelDate: addDaysToIsoDate(today, daysBefore) })),
  };
}

