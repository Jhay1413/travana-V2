import { addDaysToKey, londonDayKey, londonDayStart } from "@/lib/london-day";
import { isActiveTicket } from "./ticket-filters";
import type { Ticket } from "../types";

// Derives the "reply due" pill for a ticket. Stored due values are zone-less
// strings that mean UTC instants. A value that is exactly 00:00:00 in London is
// a legacy date-only pick and means "by the end of that London day".

export const SOON_MS = 2 * 60 * 60 * 1000;

export type DueTone = "over" | "soon" | "ok" | "none" | "closed";

export interface DuePillModel {
  tone: DueTone;
  label: string;
}

type DueTicket = Pick<Ticket, "dueDate" | "status">;

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/** Reads a stored due value as a UTC instant; null when empty or unreadable. */
export function parseTicketDue(value: string | null | undefined): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  let iso = raw.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso = `${iso}T00:00:00`;
  if (!HAS_ZONE.test(iso)) iso = `${iso}Z`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * True for a legacy date-only pick: exactly midnight in London, or exactly
 * midnight UTC (what the old date picker stored, which reads as 01:00 London
 * during summer time). Either way the London calendar day of the value is the day picked.
 */
export function isLegacyDateOnly(date: Date): boolean {
  const utcMidnight = date.getTime() % 86_400_000 === 0;
  return utcMidnight || londonDayStart(londonDayKey(date)).getTime() === date.getTime();
}

/** The moment a due value is measured against: end of the London day for date-only values. */
export function dueDeadline(date: Date): Date {
  if (!isLegacyDateOnly(date)) return date;
  return londonDayStart(addDaysToKey(londonDayKey(date), 1));
}

const LONDON_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const LONDON_DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "numeric",
  month: "short",
});

function relative(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function dayWord(date: Date, now: Date): string {
  const key = londonDayKey(date);
  const today = londonDayKey(now);
  if (key === today) return "Today";
  if (key === addDaysToKey(today, 1)) return "Tomorrow";
  return LONDON_DAY_LABEL.format(date).replace(",", "");
}

export function deriveDuePill(ticket: DueTicket, now: Date): DuePillModel {
  if (!isActiveTicket(ticket)) return { tone: "closed", label: "Closed" };
  const due = parseTicketDue(ticket.dueDate);
  if (!due) return { tone: "none", label: "No due date" };

  const deadline = dueDeadline(due);
  const remaining = deadline.getTime() - now.getTime();
  if (remaining < 0) {
    const late = relative(-remaining);
    return { tone: "over", label: late === "now" ? "Overdue" : `Overdue ${late}` };
  }
  if (remaining <= SOON_MS) return { tone: "soon", label: `Due in ${relative(remaining)}` };

  const day = dayWord(due, now);
  return { tone: "ok", label: isLegacyDateOnly(due) ? day : `${day} ${LONDON_TIME.format(due)}` };
}

/** Active (Open / In Progress) and overdue or due within two hours. */
export function isNeedsAttention(ticket: DueTicket, now: Date): boolean {
  const { tone } = deriveDuePill(ticket, now);
  return tone === "over" || tone === "soon";
}

/** The deadline in ms for sorting; tickets with no due date sort last. */
export function dueSortKey(ticket: DueTicket): number {
  const due = parseTicketDue(ticket.dueDate);
  return due ? dueDeadline(due).getTime() : Number.POSITIVE_INFINITY;
}
