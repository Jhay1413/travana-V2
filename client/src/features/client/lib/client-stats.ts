// Numbers behind the four stat boxes on the client page. Pure so the rules
// (primary quotes only, LOST bookings excluded) are unit-tested.

interface DatedRow {
  date_created?: string | null;
}

interface QuoteLike extends DatedRow {
  isQuoteCopy?: boolean | null;
  transaction_id?: string | null;
}

interface BookingLike extends DatedRow {
  transaction_id?: string | null;
  package_commission?: string | null;
  booking_status?: string | null;
}

export interface ClientStats {
  enquiries: number;
  quotes: number;
  bookings: number;
  /** Σ package_commission of non-LOST bookings. */
  profit: number;
  /** Profit per booking; 0 when there are no bookings. */
  avgPpb: number;
  lastEnquiry: Date | null;
  lastQuote: Date | null;
  lastBooking: Date | null;
}

export function isLostBooking(booking: { booking_status?: string | null }): boolean {
  return booking.booking_status?.toUpperCase() === "LOST";
}

/** Newest valid date in the list, or null when none parse. */
export function latestDate(values: Array<string | null | undefined>): Date | null {
  let best: number | null = null;
  for (const v of values) {
    if (!v) continue;
    const t = new Date(v).getTime();
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best);
}

function toNumber(value: string | null | undefined): number {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

export function computeClientStats(
  enquiries: DatedRow[],
  quotes: QuoteLike[],
  bookings: BookingLike[],
): ClientStats {
  // Matches the Live deals rail: copies are nested under their primary, and a
  // quote whose transaction already became a booking (lost bookings included)
  // is superseded and not listed, so it is not counted either.
  const bookedTransactionIds = new Set(bookings.map((b) => b.transaction_id).filter((id): id is string => !!id));
  const primaryQuotes = quotes.filter(
    (q) => !q.isQuoteCopy && !(q.transaction_id && bookedTransactionIds.has(q.transaction_id)),
  );
  const countedBookings = bookings.filter((b) => !isLostBooking(b));
  const profit = countedBookings.reduce((sum, b) => sum + toNumber(b.package_commission), 0);
  return {
    enquiries: enquiries.length,
    quotes: primaryQuotes.length,
    bookings: countedBookings.length,
    profit,
    avgPpb: countedBookings.length > 0 ? profit / countedBookings.length : 0,
    lastEnquiry: latestDate(enquiries.map((e) => e.date_created)),
    lastQuote: latestDate(primaryQuotes.map((q) => q.date_created)),
    lastBooking: latestDate(countedBookings.map((b) => b.date_created)),
  };
}

/** dd/MM/yy as a UK (Europe/London) calendar day; empty string for null. */
export function formatStatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "Europe/London" });
}
