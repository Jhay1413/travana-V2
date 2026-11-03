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
 * Pills under a rail row, in display order: Copy, Pinned, Viewed N×, Expires in Nd.
 * Views and expiry only apply to live quotes (not expired, lost, bookings or enquiries),
 * and the expiry pill only appears inside the near-expiry window, as in the reference design.
 */
export function railPills(row: HolidayRowData, state: RailPillState): RailPill[] {
  const pills: RailPill[] = [];
  if (row.isCopy) pills.push({ tone: "info", label: "Copy" });
  if (state.pinned) pills.push({ tone: "plain", label: "Pinned" });
  const live = row.type === "quote" && !row.expired && !row.lost;
  if (live && (state.viewCount ?? 0) > 0) pills.push({ tone: "good", label: `Viewed ${state.viewCount}×` });
  if (live && state.expiresInDays != null && state.expiresInDays >= 0 && state.expiresInDays <= NEAR_EXPIRY_WINDOW_DAYS) {
    pills.push({ tone: "warn", label: state.expiresInDays === 0 ? "Expires today" : `Expires in ${state.expiresInDays}d` });
  }
  return pills;
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
