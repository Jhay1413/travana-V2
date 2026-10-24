import type { EnquiryTable, EnrichedBooking, Quote, Transaction } from "@/features/quote/types";
import { isEnquiryExpired, isQuoteExpired } from "@/lib/deal-expiry";
import { isLostBooking } from "@/features/client";

// Quote joins (destination, departing airport, operator name) aren't declared on
// the base `Quote` type, but the transactions API returns them alongside it.
export type LiveQuoteRecord = Quote & {
  destination_name?: string | null;
  departing_airport_name?: string | null;
  departing_airport_code?: string | null;
  main_tour_operator_name?: string | null;
  main_tour_operator_logo_url?: string | null;
};

export interface ExpiredDealRow {
  id: string;
  kind: "quote" | "enquiry";
  title: string;
  price: number;
  operatorName: string | null;
  operatorLogoUrl: string | null;
  destinationName: string | null;
  dateLine: string | null;
  createdAt: string | null;
  isCopy: boolean;
}

const LIVE_QUOTE_EXCLUDED_STATUSES = new Set(["lost", "archived", "won"]);

function isLiveQuoteStatus(status: string | null | undefined): boolean {
  return !!status && !LIVE_QUOTE_EXCLUDED_STATUSES.has(status.toLowerCase());
}

function dealFormatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Quotes don't carry a return date — derive it from travel_date + num_of_nights.
function dealReturnDate(travelDate: string | null | undefined, nights: number | null | undefined): string | null {
  if (!travelDate || !nights) return null;
  const d = new Date(travelDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + nights);
  return dealFormatDate(d.toISOString());
}

// "LGW - 01/05/2026 → 08/05/2026" style line for a quote (airport code + dates).
export function quoteDateLine(q: LiveQuoteRecord): string | null {
  const departureDate = dealFormatDate(q.travel_date);
  const returnDate = dealReturnDate(q.travel_date, q.num_of_nights);
  const dateRange = [departureDate, returnDate].filter(Boolean).join(" → ");
  const code = q.departing_airport_code || q.departing_airport_name || null;
  return [code, dateRange || null].filter(Boolean).join(" - ") || null;
}

// Second line of a deal row: destination, dates and operator joined with " · ".
export function dealMetaLine(parts: {
  destinationName?: string | null;
  dateLine?: string | null;
  operatorName?: string | null;
}): string {
  return [parts.destinationName, parts.dateLine, parts.operatorName].filter(Boolean).join(" · ");
}

// Every quote across all of a client's transactions — including duplicate/copy
// quotes — kept when still "live" (not lost/archived/won, and not expired),
// newest first.
export function selectLiveQuotes(transactions: Transaction[] | undefined): LiveQuoteRecord[] {
  const live = (transactions ?? [])
    .flatMap((t) => (t.quotes ?? []) as LiveQuoteRecord[])
    .filter((q) => isLiveQuoteStatus(q.quote_status) && !isQuoteExpired(q));
  return [...live]
    .sort((a, b) => new Date(b.date_created || 0).getTime() - new Date(a.date_created || 0).getTime())
    .slice(0, 5);
}

// Every quote (including copies) across all of a client's transactions, when
// expired (and not won), plus each transaction's enquiry when expired — newest first.
export function selectExpiredDeals(transactions: Transaction[] | undefined): ExpiredDealRow[] {
  const rows: ExpiredDealRow[] = [];

  for (const t of transactions ?? []) {
    for (const q of (t.quotes ?? []) as LiveQuoteRecord[]) {
      if (isQuoteExpired(q) && q.quote_status?.toLowerCase() !== "won") {
        rows.push({
          id: q.id,
          kind: "quote",
          title: q.title || "Untitled quote",
          price: parseFloat(q.sales_price || "0") || 0,
          operatorName: q.main_tour_operator_name ?? null,
          operatorLogoUrl: q.main_tour_operator_logo_url ?? null,
          destinationName: q.destination_name ?? null,
          dateLine: quoteDateLine(q),
          createdAt: q.date_created,
          isCopy: Boolean(q.isQuoteCopy),
        });
      }
    }

    const e = t.enquiry as EnquiryTable | null | undefined;
    if (e && isEnquiryExpired(e)) {
      const departureDate = dealFormatDate(e.travel_date);
      const returnDate = dealReturnDate(e.travel_date, e.no_of_nights);
      const dateRange = [departureDate, returnDate].filter(Boolean).join(" → ");
      rows.push({
        id: e.id,
        kind: "enquiry",
        title: e.title || "Untitled enquiry",
        price: 0,
        operatorName: null,
        operatorLogoUrl: null,
        destinationName: e.destinations?.[0]?.name ?? null,
        dateLine: dateRange || null,
        createdAt: e.date_created,
        isCopy: false,
      });
    }
  }

  return rows
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);
}

export interface ClientDealCounts {
  enquiries: number;
  quotes: number;
  bookings: number;
}

// Mirrors computeClientStats in client/lib/client-stats.ts (the client page's
// Enquiries / Quotes / Bookings tiles): every enquiry counts; quotes are
// primary only (no copies) and drop once their transaction became a booking
// (lost bookings included); bookings exclude LOST.
export function clientDealCounts(transactions: Transaction[] | undefined): ClientDealCounts {
  const counts: ClientDealCounts = { enquiries: 0, quotes: 0, bookings: 0 };
  for (const t of transactions ?? []) {
    const booking = t.booking as EnrichedBooking | null | undefined;
    if (t.enquiry) counts.enquiries += 1;
    if (booking && !isLostBooking(booking)) counts.bookings += 1;
    if (!booking) counts.quotes += ((t.quotes ?? []) as LiveQuoteRecord[]).filter((q) => !q.isQuoteCopy).length;
  }
  return counts;
}

function num(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

export type DealKind = "booking" | "quote" | "enquiry";

export interface DealRow {
  id: string;
  kind: DealKind;
  letter: string;
  status: string;
  title: string;
  price: number;
  meta: string;
  isCopy: boolean;
  createdAt: string | null;
}

export const DEAL_TILE_CLASSES: Record<DealKind | "expired", string> = {
  booking: "bg-[#D1FAE5] text-[#047857] dark:bg-emerald-950/40 dark:text-emerald-300",
  quote: "bg-[#DBEAFE] text-[#1D4ED8] dark:bg-blue-950/40 dark:text-blue-300",
  enquiry: "bg-[#EDE9FE] text-[#6D28D9] dark:bg-violet-950/40 dark:text-violet-300",
  expired: "bg-[#FEE2E2] text-[#B91C1C] dark:bg-red-950/40 dark:text-red-300",
};

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// "2 Aug" - UTC so the output doesn't depend on the machine's timezone.
function shortDay(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

function addNights(d: Date, nights: number): Date {
  return new Date(d.getTime() + nights * 86_400_000);
}

export function bookingMetaLine(
  b: { travel_date?: string | null; num_of_nights?: number | null },
  now: Date,
): string {
  const d = parseDay(b.travel_date);
  const parts: string[] = [];
  if (d) parts.push(`${d.getTime() > now.getTime() ? "flies" : "flew"} ${shortDay(d)}`);
  if (b.num_of_nights) parts.push(`${b.num_of_nights} ${b.num_of_nights === 1 ? "night" : "nights"}`);
  return parts.join(" · ");
}

export function quoteMetaLine(q: LiveQuoteRecord): string {
  const d = parseDay(q.travel_date);
  if (!d) return dealMetaLine({ destinationName: q.destination_name, dateLine: quoteDateLine(q) });
  const range = q.num_of_nights ? `${shortDay(d)} to ${shortDay(addNights(d, q.num_of_nights))}` : shortDay(d);
  return [q.destination_name, range].filter(Boolean).join(" · ");
}

// Everything live for the client, newest first: bookings, live quotes and open enquiries.
export function selectLiveDeals(transactions: Transaction[] | undefined, now: Date): DealRow[] {
  const rows: DealRow[] = [];
  for (const t of transactions ?? []) {
    const b = t.booking as EnrichedBooking | null | undefined;
    if (b) {
      rows.push({
        id: b.id,
        kind: "booking",
        letter: "B",
        status: "Booked",
        title: b.title || "Untitled booking",
        price: num(b.total_price ?? b.sales_price),
        meta: bookingMetaLine(b, now),
        isCopy: false,
        createdAt: b.date_created,
      });
    }
    // One row per deal at its current stage: a booked deal hides its quotes and
    // enquiry, and a quoted deal hides its enquiry.
    const liveQuotes = b
      ? []
      : ((t.quotes ?? []) as LiveQuoteRecord[]).filter((q) => isLiveQuoteStatus(q.quote_status) && !isQuoteExpired(q));
    for (const q of liveQuotes) {
      rows.push({
        id: q.id,
        kind: "quote",
        letter: "Q",
        status: "Quoted",
        title: q.title || "Untitled quote",
        price: num(q.sales_price),
        meta: quoteMetaLine(q),
        isCopy: Boolean(q.isQuoteCopy),
        createdAt: q.date_created,
      });
    }
    const e = t.enquiry as EnquiryTable | null | undefined;
    if (e && !b && liveQuotes.length === 0 && !isEnquiryExpired(e)) {
      rows.push({
        id: e.id,
        kind: "enquiry",
        letter: "E",
        status: "Enquiry",
        title: e.title || "Untitled enquiry",
        price: 0,
        meta: e.destinations?.[0]?.name ?? "Dates not set",
        isCopy: false,
        createdAt: e.date_created,
      });
    }
  }
  return rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}
