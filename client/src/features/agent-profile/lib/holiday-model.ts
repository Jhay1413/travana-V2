import type { LeaveEntry, LeaveStatus } from "@/features/hr";
import type { PillTone } from "@/features/admin-dashboard";
import type { OpeningPattern } from "../types";
import { addDays, dayOf, formatRange, makeKey, parseKey } from "./dates";
import { plural } from "./money";
import { clipRange, countWorkingDays } from "./working-days";

export interface HolidayRow {
  id: string;
  dates: string;
  note: string;
  days: number;
  statusLabel: string;
  tone: PillTone;
}

export interface HolidayModel {
  year: number;
  allowance: number | null;
  /** Approved annual leave on working days up to and including today. */
  taken: number;
  /** Approved annual leave on working days after today. */
  booked: number;
  /** Annual leave still waiting for approval. */
  pending: number;
  left: number;
  overBy: number;
  sickDays: number;
  takenPct: number;
  bookedPct: number;
  ariaLabel: string;
  rows: HolidayRow[];
}

const STATUS: Record<LeaveStatus, { label: string; tone: PillTone }> = {
  Approved: { label: "Approved", tone: "good" },
  Pending: { label: "Pending", tone: "warn" },
  Rejected: { label: "Rejected", tone: "bad" },
  Cancelled: { label: "Cancelled", tone: "plain" },
};

function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, (part / whole) * 100) : 0;
}

/**
 * Holiday for the current London year, counted in working days (the person's shop pattern) so it
 * agrees with the HR page. Days left = allowance - taken - booked; pending requests are shown apart.
 */
export function buildHolidayModel(input: {
  allowance: number | null;
  leaves: readonly LeaveEntry[];
  todayKey: string;
  pattern: OpeningPattern | null | undefined;
}): HolidayModel {
  const { allowance, leaves, todayKey, pattern } = input;
  const year = parseKey(todayKey).year;
  const yearStart = makeKey(year, 1, 1);
  const yearEnd = makeKey(year, 12, 31);

  let taken = 0;
  let booked = 0;
  let pending = 0;
  let sickDays = 0;
  const rows: Array<HolidayRow & { from: string }> = [];

  for (const l of leaves) {
    const clip = clipRange(l.from, l.to, yearStart, yearEnd);
    if (!clip) continue;
    // The server's count agrees with the HR page; use it when the whole leave sits inside the year.
    const whole = clip.from === dayOf(l.from) && clip.to === dayOf(l.to);
    const days = whole && l.workingDays !== undefined ? l.workingDays : countWorkingDays(clip.from, clip.to, pattern);
    if (l.status === "Approved" && l.type === "Annual") {
      const past = clipRange(clip.from, clip.to, yearStart, todayKey);
      const future = clipRange(clip.from, clip.to, addDays(todayKey, 1), yearEnd);
      if (past && !future) taken += days;
      else if (past) taken += countWorkingDays(past.from, past.to, pattern);
      if (future && !past) booked += days;
      else if (future) booked += countWorkingDays(future.from, future.to, pattern);
    }
    if (l.status === "Pending" && l.type === "Annual") pending += days;
    if (l.status === "Approved" && l.type === "Sick") sickDays += days;
    if (l.status === "Cancelled") continue;
    const s = STATUS[l.status];
    rows.push({
      id: l.id,
      from: clip.from,
      dates: formatRange(l.from, l.to),
      note: l.reason ? `${l.type} leave · ${l.reason}` : `${l.type} leave`,
      days,
      statusLabel: s.label,
      tone: s.tone,
    });
  }
  rows.sort((a, b) => (a.from < b.from ? 1 : -1));

  const total = allowance ?? 0;
  const left = Math.max(0, total - taken - booked);
  return {
    year,
    allowance,
    taken,
    booked,
    pending,
    left,
    overBy: Math.max(0, taken + booked - total),
    sickDays,
    takenPct: pctOf(taken, total),
    bookedPct: pctOf(booked, total),
    ariaLabel: `${plural(taken, "day")} taken, ${booked} booked and ${left} left of ${total}`,
    rows: rows.map(({ from: _from, ...row }) => row),
  };
}

export function sicknessLine(days: number, year: number): string {
  return days === 0 ? `No sickness recorded in ${year}.` : `Sickness in ${year}: ${plural(days, "day")}.`;
}

