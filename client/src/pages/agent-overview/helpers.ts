import type { EnrichedQuote } from "@/types/quote";

export const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export const currencyFull = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function spFormatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function spFormatPrice(price: string | null | undefined): string {
  if (!price) return "—";
  const num = parseFloat(price);
  if (isNaN(num)) return "—";
  return `£${num.toFixed(2)}`;
}

export function spIsSameDay(dateStr: string | null | undefined, target: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return (
    d.getFullYear() === target.getFullYear() &&
    d.getMonth() === target.getMonth() &&
    d.getDate() === target.getDate()
  );
}

export function spGetHotelName(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0)
    return q.accommodations[0].accomodation_name || "—";
  return "—";
}

export function spGetDepartingAirport(q: EnrichedQuote): string {
  const flights = q.flights ?? [];
  const outbound =
    flights.find((f) => f.flight_type === "outbound" && (f.leg_order === 0 || f.leg_order === null)) ??
    flights.find((f) => f.flight_type === "outbound") ??
    flights[0];
  return outbound?.departing_airport_name || q.departing_airport_name || "—";
}

export function spGetBoardBasis(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0)
    return q.accommodations[0].board_basis_name || "—";
  return "—";
}

export function spGetFirstImage(q: EnrichedQuote): string | null {
  if (q.images && q.images.length > 0) {
    const primary = q.images.find((img) => img.isPrimary);
    return (primary || q.images[0]).image_url || null;
  }
  return null;
}

export function spGetSubtitle(q: EnrichedQuote): string {
  const parts: string[] = [];
  if (q.country_name) parts.push(q.country_name);
  if (q.destination_name) parts.push(q.destination_name);
  return parts.join(" · ") || "—";
}

export function getQuoteProfit(q: any): number {
  return parseFloat(q.package_commission) || 0;
}
