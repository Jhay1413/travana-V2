import { format } from "date-fns";

/** Wall-clock "YYYY-MM-DDTHH:mm" plus the absolute UTC instant it represents in the browser's timezone. */
export interface CombinedSchedule {
  local: string;
  utcIso: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Combines a picked date ("YYYY-MM-DD") and time ("HH:mm").
 * `local` is sent verbatim to OnlySocials (no timezone); `utcIso` is stored in the DB.
 */
export function combineLocal(dateYmd: string, timeHm: string): CombinedSchedule {
  const local = `${dateYmd}T${timeHm}`;
  return { local, utcIso: new Date(local).toISOString() };
}

/** Inverse of `combineLocal`'s `local`. Missing parts come back as empty strings. */
export function splitLocal(local: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(local);
  return { date: match?.[1] ?? "", time: match?.[2] ?? "" };
}

/** "HH:mm" -> "9:00 AM". Returns the input unchanged when it is not a valid time. */
export function time12(hm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hm);
  if (!match) return hm;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return hm;
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${pad(minutes)} ${suffix}`;
}

const parseLocal = (local: string): Date | null => {
  const { date, time } = splitLocal(local);
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "Goes out Tue 21 Oct at 9:00 AM", or an empty string for an incomplete value. */
export function goesOutLabel(local: string): string {
  const d = parseLocal(local);
  if (!d) return "";
  return `Goes out ${format(d, "EEE d MMM")} at ${time12(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}

/** True when the wall-clock value is a complete date+time strictly after `now`. */
export function isFutureLocal(local: string, now: Date = new Date()): boolean {
  const d = parseLocal(local);
  return d !== null && d.getTime() > now.getTime();
}

/**
 * Label for the zone `combineLocal` uses (the browser's). Shows the org zone
 * only when it matches the browser zone; otherwise the browser zone plus a hint.
 * `browserZone` is injectable for tests.
 */
export function browserTimezoneLabel(
  orgTimezone?: string,
  browserZone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
): string {
  if (orgTimezone && orgTimezone === browserZone) return orgTimezone;
  return `${browserZone} (your browser's time zone)`;
}
