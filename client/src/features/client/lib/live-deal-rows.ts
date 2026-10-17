import { isQuoteExpired, isEnquiryExpired, isBookingExpired, isQuoteLost, isEnquiryLost } from "@/lib/deal-expiry";
import type { EnquiryTable, Quote } from "@/features/quote/types";
import type { HolidayBooking, HolidaySelection } from "@/features/client/types";
import { isPrimaryQuote } from "@/features/client/components/client-types";
import { isLostBooking } from "@/features/client/lib/client-stats";

// Quote joins (destination, departing airport, operator name) aren't declared on the
// base `Quote` type, but the transactions API returns them alongside it — same shape
// ContactPanel's LiveQuoteRecord casts around in the conversations inbox.
type QuoteRow = Quote & {
  destination_name?: string | null;
  main_tour_operator_name?: string | null;
  main_tour_operator_logo_url?: string | null;
  departing_airport_name?: string | null;
  departing_airport_code?: string | null;
};

// Bookings get the same operator joins from the transactions API.
type BookingRow = HolidayBooking & {
  main_tour_operator_name?: string | null;
  main_tour_operator_logo_url?: string | null;
};


// Customer-facing net total = sales_price − discounts + service_charge — same
// formula used for quote/booking rows elsewhere on this page (see
// use-client-quote-groups.ts's NET_PRICE).
export function netPrice(sales: string | null | undefined, discounts: string | null | undefined, serviceCharge: string | null | undefined): number {
  return parseFloat(sales || "0") - parseFloat(discounts || "0") + parseFloat(serviceCharge || "0");
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Quotes/bookings/enquiries don't carry a return date — derive it from travel_date + nights.
function computeReturnDate(travelDate: string | null | undefined, nights: number | null | undefined): string | null {
  if (!travelDate || !nights) return null;
  const d = new Date(travelDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + nights);
  return formatShortDate(d.toISOString());
}

// "CODE - dd/mm/yyyy → dd/mm/yyyy" — matches the Live Quotes row in the conversations
// inbox ContactPanel exactly; any missing piece is dropped rather than invented.
function buildDateLine(code: string | null, travelDate: string | null | undefined, nights: number | null | undefined): string | null {
  const departureDate = formatShortDate(travelDate);
  const returnDate = computeReturnDate(travelDate, nights);
  const dateRange = [departureDate, returnDate].filter(Boolean).join(" → ");
  const line = [code, dateRange || null].filter(Boolean).join(" - ");
  return line || null;
}


// ─── Row model ──────────────────────────────────────────────────────────────

export interface HolidayRowData {
  id: string;
  type: HolidaySelection["type"];
  title: string;
  price: number;
  operatorName: string | null;
  operatorLogoUrl: string | null;
  destinationName: string | null;
  dateLine: string | null;
  createdAt: string | null;
  expired: boolean;
  /** Lost deals get their own section and take precedence over `expired`. */
  lost: boolean;
  /** True for a quote duplicated from another — rendered nested with a "Copy" pill. */
  isCopy: boolean;
  /** Copies duplicated from this row, nested underneath it. Empty for enquiries/bookings/copies. */
  copies: HolidayRowData[];
}

function buildQuoteRow(qr: QuoteRow): HolidayRowData {
  const code = qr.departing_airport_code || qr.departing_airport_name || null;
  return {
    id: qr.id,
    type: "quote" as const,
    title: qr.title || "Untitled quote",
    price: netPrice(qr.sales_price, qr.discounts, qr.service_charge),
    operatorName: qr.main_tour_operator_name ?? null,
    operatorLogoUrl: qr.main_tour_operator_logo_url ?? null,
    destinationName: qr.destination_name ?? null,
    dateLine: buildDateLine(code, qr.travel_date, qr.num_of_nights),
    createdAt: qr.date_created,
    expired: isQuoteExpired(qr),
    lost: isQuoteLost(qr),
    isCopy: Boolean(qr.isQuoteCopy),
    copies: [],
  };
}

// A quote's transaction that has already progressed to a booking is superseded —
// the API still returns the quote row alongside the booking (it isn't deleted,
// just won), so it must be dropped here or it lingers in the Quotes tab forever.
export function buildQuoteRows(quotes: Quote[], bookedTransactionIds: Set<string>): HolidayRowData[] {
  const quoteRows = (quotes as QuoteRow[]).filter((q) => !bookedTransactionIds.has(q.transaction_id));
  const primaries = quoteRows.filter(isPrimaryQuote);
  const copies = quoteRows.filter((q) => q.isQuoteCopy);

  const primaryRowsById = new Map(primaries.map((q) => [q.id, buildQuoteRow(q)]));
  // Group copies under the primary they belong to; older copies may not have
  // parent_quote_id set, so fall back to matching by transaction — a copy
  // always shares its origin transaction with the primary it was duplicated
  // from. If neither resolves (e.g. the primary was soft-deleted), the copy
  // is rendered as its own top-level row so it never disappears.
  const primaryByTransactionId = new Map<string, QuoteRow>();
  for (const q of primaries) {
    if (!primaryByTransactionId.has(q.transaction_id)) primaryByTransactionId.set(q.transaction_id, q);
  }

  const orphanCopyRows: HolidayRowData[] = [];
  for (const copy of copies) {
    const parentId = copy.parent_quote_id && primaryRowsById.has(copy.parent_quote_id)
      ? copy.parent_quote_id
      : primaryByTransactionId.get(copy.transaction_id)?.id;
    const parentRow = parentId ? primaryRowsById.get(parentId) : undefined;
    if (parentRow) {
      parentRow.copies.push(buildQuoteRow(copy));
    } else {
      orphanCopyRows.push(buildQuoteRow(copy));
    }
  }

  return [...primaryRowsById.values(), ...orphanCopyRows];
}

export function buildEnquiryRows(enquiries: EnquiryTable[]): HolidayRowData[] {
  return enquiries.map((e) => ({
    id: e.id,
    type: "enquiry" as const,
    title: e.title || "Untitled enquiry",
    price: 0,
    operatorName: null,
    operatorLogoUrl: null,
    destinationName: e.destinations?.[0]?.name ?? null,
    dateLine: buildDateLine(null, e.travel_date, e.no_of_nights),
    createdAt: e.date_created,
    expired: isEnquiryExpired(e),
    lost: isEnquiryLost(e),
    isCopy: false,
    copies: [],
  }));
}

export function buildBookingRows(bookings: HolidayBooking[], options: { markLostBookings?: boolean } = {}): HolidayRowData[] {
  return bookings.map((b) => {
    const br = b as BookingRow;
    return {
      id: b.id,
      type: "booking" as const,
      title: b.title || "Untitled booking",
      price: netPrice(b.sales_price, b.discounts, b.service_charge),
      operatorName: br.main_tour_operator_name ?? null,
      operatorLogoUrl: br.main_tour_operator_logo_url ?? null,
      // Bookings carry no destination join in the transactions payload.
      destinationName: null,
      dateLine: buildDateLine(null, b.travel_date, b.num_of_nights),
      createdAt: b.date_created,
      expired: isBookingExpired(b),
      lost: options.markLostBookings === true && isLostBooking(b),
      isCopy: false,
      copies: [],
    };
  });
}

// Pinned rows lead; within the pinned and unpinned blocks the user's date order holds.
export function sortRows(rows: HolidayRowData[], order: "newest" | "oldest", pinnedKeys: ReadonlySet<string>): HolidayRowData[] {
  const isPinned = (r: HolidayRowData) => pinnedKeys.has(`${r.type}:${r.id}`);
  return [...rows]
    .map((row) => (row.copies.length > 0 ? { ...row, copies: sortRows(row.copies, order, pinnedKeys) } : row))
    .sort((a, b) => {
      const pinDiff = Number(isPinned(b)) - Number(isPinned(a));
      if (pinDiff !== 0) return pinDiff;
      const diff = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return order === "newest" ? diff : -diff;
    });
}

// ─── Live deals rail: sort, price band, search ──────────────────────────────

export type DealSort = "newest" | "oldest" | "highest" | "lowest";
export type PriceBand = "any" | "under" | "over";

export const PRICE_BAND_THRESHOLD = 3000;

export const DEAL_SORT_LABELS: Record<DealSort, string> = {
  newest: "Newest",
  oldest: "Oldest",
  highest: "Highest price",
  lowest: "Lowest price",
};

export const PRICE_BAND_LABELS: Record<PriceBand, string> = {
  any: "Any price",
  under: "Under £3,000",
  over: "£3,000 and over",
};

function createdTime(row: HolidayRowData): number {
  return new Date(row.createdAt || 0).getTime();
}

/** Pinned rows lead; within each block the chosen sort applies (copies are sorted too). */
export function sortDealRows(rows: HolidayRowData[], sort: DealSort, pinnedKeys: ReadonlySet<string>): HolidayRowData[] {
  const isPinned = (r: HolidayRowData) => pinnedKeys.has(`${r.type}:${r.id}`);
  const compare = (a: HolidayRowData, b: HolidayRowData): number => {
    switch (sort) {
      case "highest":
        return b.price - a.price || createdTime(b) - createdTime(a);
      case "lowest":
        return a.price - b.price || createdTime(b) - createdTime(a);
      case "oldest":
        return createdTime(a) - createdTime(b);
      default:
        return createdTime(b) - createdTime(a);
    }
  };
  return [...rows]
    .map((row) => (row.copies.length > 0 ? { ...row, copies: sortDealRows(row.copies, sort, pinnedKeys) } : row))
    .sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || compare(a, b));
}

function inBand(row: HolidayRowData, band: PriceBand): boolean {
  if (band === "under") return row.price < PRICE_BAND_THRESHOLD;
  if (band === "over") return row.price >= PRICE_BAND_THRESHOLD;
  return true;
}

/**
 * Search (title / destination) and price band. A group survives when the parent
 * or any copy matches, and the whole group is kept together.
 */
export function filterDealRows(rows: HolidayRowData[], search: string, band: PriceBand): HolidayRowData[] {
  const q = search.trim().toLowerCase();
  const matchesSearch = (r: HolidayRowData) =>
    !q || r.title.toLowerCase().includes(q) || (r.destinationName ?? "").toLowerCase().includes(q);
  const matches = (r: HolidayRowData) => matchesSearch(r) && inBand(r, band);
  return rows.filter((r) => matches(r) || r.copies.some(matches));
}

export interface DealRowGroups {
  active: HolidayRowData[];
  expired: HolidayRowData[];
  lost: HolidayRowData[];
}

/** Lost beats expired; everything else is active. */
export function groupDealRows(rows: HolidayRowData[]): DealRowGroups {
  return {
    active: rows.filter((r) => !r.expired && !r.lost),
    expired: rows.filter((r) => r.expired && !r.lost),
    lost: rows.filter((r) => r.lost),
  };
}
