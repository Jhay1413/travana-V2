import { formatPassengerDate } from "@/features/client/lib/client-passengers";

/** What the upload dialog needs from one of the client's deals (an enquiry, quote or booking row). */
export interface AllocationDeal {
  id: string;
  title?: string | null;
  travel_date?: string | null;
  quote_type?: string | null;
  quote_status?: string | null;
}

export interface AllocationOption {
  /** The deal's real id: the value stored as the file's allocationId. */
  id: string;
  label: string;
}

/** "Hard Rock Hotel Tenerife · 09/04/2027", or just the title when there is no travel date. */
function dealLabel(deal: AllocationDeal, fallback: string): string {
  const title = deal.title?.trim() || fallback;
  const date = formatPassengerDate(deal.travel_date);
  return date === "—" ? title : `${title} · ${date}`;
}

export const ENQUIRY_FALLBACK = "Untitled enquiry";
export const BOOKING_FALLBACK = "Untitled booking";

export function enquiryAllocationOptions(enquiries: ReadonlyArray<AllocationDeal>): AllocationOption[] {
  return enquiries.map((e) => ({ id: e.id, label: dealLabel(e, ENQUIRY_FALLBACK) }));
}

/** The client's real bookings: the stored id is the booking's id, which is what lets the portal show the file under it. */
export function bookingAllocationOptions(bookings: ReadonlyArray<AllocationDeal>): AllocationOption[] {
  return bookings.map((b) => ({ id: b.id, label: dealLabel(b, BOOKING_FALLBACK) }));
}

/** Quotes keep the dialog's existing list and wording ("Title - Status"). */
export function quoteAllocationOptions(quotes: ReadonlyArray<AllocationDeal>): AllocationOption[] {
  return quotes
    .map((q) => ({ id: q.id, label: `${q.title || q.quote_type || "Quote"} - ${q.quote_status || "—"}` }));
}

/** The words shown when the client has none of the chosen kind, e.g. "This client has no bookings yet." */
export function noAllocationsMessage(kind: "Enquiry" | "Quote" | "Booking"): string {
  const plural = kind === "Enquiry" ? "enquiries" : kind === "Quote" ? "quotes" : "bookings";
  return `This client has no ${plural} yet.`;
}
