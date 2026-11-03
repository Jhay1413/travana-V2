import type { TicketHolidaySummary } from "../types";

// Presentation lookups for the redesigned tickets pages. Pure strings only
// (class names are Tailwind tokens from index.css) so they can be unit tested;
// the icon components live next to the components that render them.

export type KindKey = "Sales" | "Admin" | "Build";

export interface KindMeta {
  key: KindKey | "other";
  label: string;
  className: string;
}

export function kindMeta(type: string): KindMeta {
  switch (type) {
    case "Sales":
      return { key: "Sales", label: "Sales", className: "bg-status-scheduled-bg text-status-scheduled-fg" };
    case "Admin":
      return { key: "Admin", label: "Admin", className: "bg-status-posted-bg text-status-posted-fg" };
    case "Build":
      return { key: "Build", label: "Build", className: "bg-status-draft-bg text-status-draft-fg" };
    default:
      return { key: "other", label: type || "Other", className: "bg-status-draft-bg text-status-draft-fg" };
  }
}

export interface PriorityMeta {
  label: string;
  /** Medium renders as the design's "normal" priority. */
  tone: "low" | "normal" | "high" | "urgent";
  dotClass: string;
}

export function priorityMeta(priority: string): PriorityMeta {
  switch (priority) {
    case "Urgent":
      return { label: "Urgent", tone: "urgent", dotClass: "bg-priority-urgent" };
    case "High":
      return { label: "High", tone: "high", dotClass: "bg-social-orange" };
    case "Low":
      return { label: "Low", tone: "low", dotClass: "bg-social-muted" };
    default:
      return { label: priority || "Medium", tone: "normal", dotClass: "bg-stage-inplay-dot" };
  }
}

export interface StatusMeta {
  label: string;
  chipClass: string;
  dotClass: string;
  /** Slug used in data-testids, e.g. "in-progress". */
  slug: string;
}

export function statusMeta(status: string): StatusMeta {
  const slug = status.toLowerCase().replace(/\s+/g, "-");
  switch (status) {
    case "Open":
      return { label: status, slug, chipClass: "bg-status-posted-bg text-status-posted-fg", dotClass: "bg-stage-inplay-dot" };
    case "In Progress":
      return { label: status, slug, chipClass: "bg-ticket-amber-bg text-ticket-amber-fg", dotClass: "bg-social-orange" };
    case "Resolved":
      return { label: status, slug, chipClass: "bg-status-scheduled-bg text-status-scheduled-fg", dotClass: "bg-stage-booked-dot" };
    default:
      return { label: status || "Closed", slug, chipClass: "bg-status-draft-bg text-status-draft-fg", dotClass: "bg-stage-future-dot" };
  }
}

/** "TKT-1A2B3C4D" style short code from a uuid: the first block, upper-cased. */
export function shortId(id: string): string {
  return id.split("-")[0]?.toUpperCase() ?? id.toUpperCase();
}

const LONG_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", year: "numeric" });

export function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : LONG_DATE.format(date);
}

/** "12 Jun 2026 · 7 nights" under a holiday's title; null when nothing is known. */
export function holidaySubLine(holiday: Pick<TicketHolidaySummary, "travelDate" | "nights" | "operatorName">): string | null {
  const parts: string[] = [];
  const date = formatShortDate(holiday.travelDate);
  if (date) parts.push(date);
  if (holiday.nights != null && holiday.nights > 0) parts.push(`${holiday.nights} ${holiday.nights === 1 ? "night" : "nights"}`);
  if (parts.length === 0 && holiday.operatorName) parts.push(holiday.operatorName);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Client name as shown in the UI: the API returns the string "null" for missing names. */
export function cleanClientName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : null;
}
