// Pure helpers for the redesigned "All holidays" rail. Row building, grouping and
// search live in live-deal-rows.ts; this file only adds what the rail needs on top.
import type { PillTone } from "@/components/shared/status-pill";
import type { Quote } from "@/features/quote/types";
import { getQuoteExpiryInfo, NEAR_EXPIRY_WINDOW_DAYS } from "@/features/quote/lib/quote-expiry";
import type { HolidaySelection } from "@/features/client/types";
import type { DealRowGroups, HolidayRowData } from "@/features/client/lib/live-deal-rows";

export type RailTab = "enquiry" | "quotes" | "bookings";

export interface RailCounts {
  enquiry: number;
  quotes: number;
  bookings: number;
}

export interface RailPill {
  tone: PillTone;
  label: string;
}

/** The tab that reveals the selected deal; Quotes when nothing is selected. */
export function defaultRailTab(sel: HolidaySelection | null): RailTab {
  if (!sel) return "quotes";
  if (sel.type === "enquiry") return "enquiry";
  if (sel.type === "booking") return "bookings";
  return "quotes";
}

/** Quotes counts the live (active) quotes plus their nested copies; expired and lost are excluded. */
export function railCounts(enquiries: HolidayRowData[], quoteGroups: DealRowGroups, bookings: HolidayRowData[]): RailCounts {
  const quotes = quoteGroups.active.reduce((sum, row) => sum + 1 + row.copies.length, 0);
  return { enquiry: enquiries.length, quotes, bookings: bookings.length };
}

/** "Gatwick (LGW)" -> "LGW"; null when the name carries no bracketed code. */
export function airportCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return /\((\w+)\)/.exec(name)?.[1] ?? null;
}

export interface RailPillState {
  pinned: boolean;
  /** Times the client opened this quote (0 or undefined when never). */
  viewCount?: number;
  /** Whole days until the quote expires; null when no countdown applies. */
  expiresInDays?: number | null;
}

/**
 * Small pills under a rail row, in display order: Pinned, Viewed N×.
 * Copy sits next to the title and expiry is an icon (see railExpiryLabel), so neither is a pill.
 * Views only apply to live quotes (not expired, lost, bookings or enquiries).
 */
export function railPills(row: HolidayRowData, state: RailPillState): RailPill[] {
  const pills: RailPill[] = [];
  if (state.pinned) pills.push({ tone: "plain", label: "Pinned" });
  if (isLiveQuote(row) && (state.viewCount ?? 0) > 0) pills.push({ tone: "good", label: `Viewed ${state.viewCount}×` });
  return pills;
}

/**
 * Tooltip text for the expiry icon on a live quote inside the near-expiry window
 * ("Expires today" / "Expires in 1 day" / "Expires in N days"); null when no icon applies.
 */
export function railExpiryLabel(row: HolidayRowData, state: RailPillState): string | null {
  const days = state.expiresInDays;
  if (!isLiveQuote(row) || days == null || days < 0 || days > NEAR_EXPIRY_WINDOW_DAYS) return null;
  if (days === 0) return "Expires today";
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

function isLiveQuote(row: HolidayRowData): boolean {
  return row.type === "quote" && !row.expired && !row.lost;
}

/**
 * Days left per quote id. Only quotes with an explicit expiry date get a countdown
 * (the date_created + 7d fallback has no day count to show).
 */
export function quoteRailMeta(quotes: Quote[], now: Date): Map<string, { expiresInDays: number | null }> {
  const meta = new Map<string, { expiresInDays: number | null }>();
  for (const q of quotes) {
    const info = getQuoteExpiryInfo(q.date_expiry, q.date_created, now);
    meta.set(q.id, { expiresInDays: info && info.status !== "expired" ? info.diffDays : null });
  }
  return meta;
}
