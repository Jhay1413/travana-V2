import { londonDayKey } from "@/lib/london-day";
import { isLegacyDateOnly } from "./ticket-due";

// Converts between a London wall-clock date + time (what the due-date picker
// shows) and the UTC instant that gets stored. DST-safe in both directions.

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Milliseconds London is ahead of UTC at the given instant. */
function offsetMs(instant: number): number {
  const p: Record<string, number> = {};
  for (const part of PARTS.formatToParts(new Date(instant))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** "2026-10-16" + "14:30" in London time -> ISO instant. Null when either part is invalid. */
export function londonDateTimeToIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const naive = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  if (Number.isNaN(naive)) return null;
  const first = naive - offsetMs(naive);
  const instant = new Date(naive - offsetMs(first));
  // A deliberate 00:00 / 01:00 pick would read back as a legacy date-only value;
  // one extra second keeps it a precise time.
  return new Date(isLegacyDateOnly(instant) ? instant.getTime() + 1000 : instant.getTime()).toISOString();
}

export interface LondonParts {
  date: string;
  time: string;
}

const TIME_ONLY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The London calendar day and HH:mm of an instant; null when unreadable. */
export function isoToLondonParts(value: Date | string | null | undefined): LondonParts | null {
  if (!value) return null;
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  return { date: londonDayKey(instant), time: TIME_ONLY.format(instant) };
}

/** Quarter-hour slots for the time select: "00:00" ... "23:45". */
export function quarterHourSlots(): string[] {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return out;
}
