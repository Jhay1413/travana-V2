import type { EnrichedQuote } from "@/features/quote/types";
import type { GeneratePostParams } from "../api/social-post.api";

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  const datePart = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${datePart} ${timePart}`;
}

export function formatPrice(price: string | null | undefined): string {
  if (!price) return "—";
  const num = parseFloat(price);
  if (isNaN(num)) return "—";
  return `£${num.toFixed(2)}`;
}

export function getSubtitle(q: EnrichedQuote): string {
  const parts: string[] = [];
  if (q.country_name) parts.push(q.country_name);
  if (q.destination_name) parts.push(q.destination_name);
  if (!parts.length && q.park_name) parts.push(q.park_name);
  if (!parts.length && q.park_location) parts.push(q.park_location);
  return parts.join(" · ") || "—";
}

export function getHotelName(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].accomodation_name || "—";
  if (q.lodge_name) return q.lodge_name;
  if (q.park_name) return q.park_name;
  return "—";
}

export function getDepartingAirport(q: EnrichedQuote): string {
  const flights = q.flights ?? [];
  const outbound =
    flights.find((f) => f.flight_type === "outbound" && (f.leg_order === 0 || f.leg_order === null)) ??
    flights.find((f) => f.flight_type === "outbound") ??
    flights[0];
  return outbound?.departing_airport_name || q.departing_airport_name || "—";
}

export function getBoardBasis(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].board_basis_name || "—";
  return "—";
}

export function getFirstImage(q: EnrichedQuote): string | null {
  if (q.images && q.images.length > 0) {
    const primary = q.images.find((img) => img.isPrimary);
    return (primary || q.images[0]).image_url || null;
  }
  return null;
}

export function getCruise(q: EnrichedQuote) {
  return q.cruises && q.cruises.length > 0 ? q.cruises[0] : undefined;
}

export function isCruiseQuote(q: EnrichedQuote): boolean {
  return (q.cruises?.length ?? 0) > 0
    || (q.quote_type || "").toLowerCase().includes("cruise")
    || (q.holiday_type_name || "").toLowerCase().includes("cruise");
}

export function isLodgeQuote(q: EnrichedQuote): boolean {
  return q.quote_type === "hot_tub_break"
    || !!q.lodge_id
    || !!q.park_id
    || (q.quote_type || "").toLowerCase().includes("lodge")
    || (q.holiday_type_name || "").toLowerCase().includes("lodge");
}

export function getGuests(q: EnrichedQuote): number {
  return (q.adult ?? 0) + (q.child ?? 0);
}

/** "£1,379.00pp", or "—" when the quote has no per-person price. */
export function pricePerPersonLabel(q: EnrichedQuote): string {
  const num = parseFloat(q.price_per_person ?? "");
  if (isNaN(num)) return "—";
  return `£${num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}pp`;
}

/** Request params for generating a post from a quote, or an error message when it cannot be generated. */
export function buildGenerateParams(q: EnrichedQuote): GeneratePostParams | { error: string } {
  if (!q.travel_date) return { error: "Cannot generate post — travel date is missing" };
  const isHotTub = q.quote_type === "hot_tub_break";
  const destination = isHotTub
    ? [q.park_name, q.park_location].filter(Boolean).join(", ") || "Unknown"
    : [q.country_name, q.destination_name].filter(Boolean).join(", ") || "Unknown";
  const nights = q.num_of_nights > 0 ? q.num_of_nights : 1;
  const boardBasis = !isHotTub && getBoardBasis(q) !== "—" ? getBoardBasis(q) : undefined;
  const departureAirport = !isHotTub && getDepartingAirport(q) !== "—" ? getDepartingAirport(q) : undefined;
  return {
    quoteId: q.id,
    title: q.title || "Holiday Deal",
    destination,
    nights,
    boardBasis,
    departureAirport,
    transferType: q.transfer_type || undefined,
    salesPrice: q.sales_price || undefined,
    pricePerPerson: q.price_per_person || undefined,
    travelDate: q.travel_date,
    quoteType: q.quote_type,
    lodgeName: q.lodge_name || undefined,
    parkName: q.park_name || undefined,
    parkLocation: q.park_location || undefined,
    tourOperator: q.main_tour_operator_name || undefined,
  };
}
