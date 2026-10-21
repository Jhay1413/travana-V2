/**
 * Pure helpers for the "Against {first name}'s other quotes" card: which
 * quotes sit beside the current one, which column is cheapest per person and
 * the text of each comparison row.
 */
import { isQuoteExpired, isQuoteLost } from "@/lib/deal-expiry";
import type { Quote } from "@/features/quote/types";
import type { QuoteDisplay } from "@/features/quote/components/quote-types";
import { formatUKDate } from "@/features/quote/components/quote-types";
import { timeAgo } from "@/features/quote/lib/quote-views";

export const MAX_COMPARE_OTHERS = 2;

function createdTime(q: Quote): number {
  const t = Date.parse(q.date_created ?? "");
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Up to two other live quotes for the client, newest first. A quote is live
 * when it is not expired, not lost and its deal has not been booked.
 */
export function pickCompareQuotes(currentId: string, quotes: readonly Quote[], bookedTransactionIds: ReadonlySet<string>): Quote[] {
  return quotes
    .filter((q) => q.id !== currentId && !bookedTransactionIds.has(q.transaction_id) && !isQuoteExpired(q) && !isQuoteLost(q))
    .sort((a, b) => createdTime(b) - createdTime(a))
    .slice(0, MAX_COMPARE_OTHERS);
}

/** Index of the cheapest price per person, ignoring prices of zero or less. Ties go to the first. */
export function cheapestIndex(columns: ReadonlyArray<{ pricePerPerson: number }>): number | null {
  let best: number | null = null;
  columns.forEach((c, i) => {
    if (!(c.pricePerPerson > 0)) return;
    if (best === null || c.pricePerPerson < columns[best]!.pricePerPerson) best = i;
  });
  return best;
}

export interface CompareColumn {
  id: string;
  title: string;
  place: string;
  imageUrl: string | null;
  total: number;
  pricePerPerson: number;
  dates: string;
  board: string;
  outbound: string;
  views: string;
  isCurrent: boolean;
}

export interface CompareViewsInput {
  viewCount: number;
  lastViewedAt: string | null;
}

/** "02/11/2026 · 7 nights", or whichever half exists. */
export function compareDates(q: Pick<QuoteDisplay, "travelDate" | "nights">): string {
  const date = q.travelDate ? formatUKDate(q.travelDate) : "";
  const nights = q.nights > 0 ? `${q.nights} night${q.nights !== 1 ? "s" : ""}` : "";
  return [date, nights].filter(Boolean).join(" · ") || "Not set";
}

/** "depart from {airport}", or "Not set". */
export function compareOutbound(q: Pick<QuoteDisplay, "flights">): string {
  const from = q.flights.outbound.from;
  return from ? `depart from ${from}` : "Not set";
}

/** "3 views, last 2 days ago" or "Not opened". */
export function compareViews(views: CompareViewsInput | null | undefined, now: Date = new Date()): string {
  if (!views || views.viewCount <= 0) return "Not opened";
  const n = views.viewCount;
  const ago = timeAgo(views.lastViewedAt, now);
  return `${n} view${n !== 1 ? "s" : ""}${ago ? `, last ${ago}` : ""}`;
}

export function buildCompareColumn(
  q: QuoteDisplay,
  extras: { imageUrl: string | null; views: CompareViewsInput | null | undefined; isCurrent: boolean; now?: Date },
): CompareColumn {
  return {
    id: q.id,
    title: q.quoteTitle || "Untitled quote",
    place: [q.destinationName, q.countryName].filter(Boolean).join(", "),
    imageUrl: extras.imageUrl,
    total: q.commissions.price,
    pricePerPerson: q.pricePerPerson,
    dates: compareDates(q),
    board: q.accommodation.board || "Not set",
    outbound: compareOutbound(q),
    views: compareViews(extras.views, extras.now),
    isCurrent: extras.isCurrent,
  };
}
