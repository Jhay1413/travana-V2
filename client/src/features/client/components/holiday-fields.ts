// Pure builders for the "holiday details" field rows shown on a quote, booking
// or enquiry. Icons are referenced by string key so this module stays free of
// React/lucide and can be unit tested in node; holiday-field-icons.ts maps the
// keys to lucide components.
import { currency, formatUKDate, formatLeadSource, type QuoteDisplay } from "@/features/quote/components/quote-types";
import type { EnquiryTable } from "@/features/quote/types";

export type FieldIconKey =
  | "calendar-days"
  | "hotel"
  | "bed-double"
  | "utensils"
  | "bus"
  | "plane-takeoff"
  | "globe"
  | "users"
  | "moon-star"
  | "square-arrow-right"
  | "package-plus"
  | "calendar-range"
  | "anchor"
  | "map-pin"
  | "ship"
  | "dog"
  | "star"
  | "badge-pound-sterling"
  | "user-round"
  | "tag";

export interface FieldRowSpec {
  key: string;
  icon: FieldIconKey;
  label: string;
  value: string | null;
}

export function formatBudgetType(budgetType?: string | null): string {
  if (!budgetType) return "";
  return budgetType === "PER_PERSON" ? "pp" : ` ${budgetType.toLowerCase()}`;
}

export function formatQuotePassengers(quote: QuoteDisplay): string | null {
  const adults = quote.passengers?.adults ?? 0;
  const children = quote.passengers?.children ?? 0;
  const infants = quote.passengersInfants ?? 0;
  if (!adults && !children && !infants) return null;
  const parts = [`${adults} Adult${adults === 1 ? "" : "s"}`];
  if (children) parts.push(`${children} Child${children === 1 ? "" : "ren"}`);
  if (infants) parts.push(`${infants} Infant${infants === 1 ? "" : "s"}`);
  return parts.join(", ");
}

// Same field set for quotes and bookings — both share the QuoteDisplay shape
// produced by transformQuoteData.
export function buildQuoteLikeFields(item: QuoteDisplay): { left: FieldRowSpec[]; right: FieldRowSpec[] } {
  return {
    // Icons are lucide marks, referenced by key (see holiday-field-icons.ts).
    left: [
      { key: "travel-date", icon: "calendar-days", label: "Travel Date", value: item.travelDate ? formatUKDate(item.travelDate) : null },
      { key: "hotel", icon: "hotel", label: "Hotel", value: item.accommodation?.property || null },
      { key: "room-type", icon: "bed-double", label: "Room Type", value: item.accommodation?.roomType || null },
      { key: "board-basis", icon: "utensils", label: "Board Basis", value: item.accommodation?.board || null },
      { key: "transfer-type", icon: "bus", label: "Transfer Type", value: item.transferType || "Private Transfer" },
    ],
    right: [
      { key: "departure-airport", icon: "plane-takeoff", label: "Departure Airport", value: item.flights?.outbound?.from || null },
      { key: "tour-operator", icon: "globe", label: "Tour Operator", value: item.commissions?.tourOperator || null },
      { key: "no-passengers", icon: "users", label: "No. Passengers", value: formatQuotePassengers(item) },
      { key: "no-nights", icon: "moon-star", label: "No. Nights", value: item.nights != null ? `${item.nights} night${item.nights === 1 ? "" : "s"}` : null },
      { key: "lead-source", icon: "square-arrow-right", label: "Lead Source", value: item.leadSource ? formatLeadSource(item.leadSource) : null },
    ],
  };
}

// The enquiry endpoint returns joined names under per-relation keys
// (destination_name, resort_name, ...) rather than a shared `name`.
export function joinNames(items: ReadonlyArray<string | null | undefined> | undefined): string | null {
  const names = (items ?? []).filter((n): n is string => !!n);
  return names.length ? names.join(", ") : null;
}

export function buildEnquiryFields(enquiry: EnquiryTable, agentName: string | null): { left: FieldRowSpec[]; right: FieldRowSpec[] } {
  const holidayType = enquiry.holiday_type_name?.toLowerCase() ?? "";
  const isHotTub = holidayType.includes("hot tub");
  const isCruise = holidayType.includes("cruise");
  const isStandard = !isHotTub && !isCruise;

  const destinationNames = joinNames(enquiry.destinations?.map((d) => d.destination_name ?? d.name));
  const resortNames = joinNames(enquiry.resorts?.map((r) => r.resort_name ?? r.name));
  const airportNames = joinNames(enquiry.airports?.map((a) => a.airport_name ?? a.name));
  const boardBasisNames = joinNames(enquiry.boardBases?.map((b) => b.board_basis_name ?? b.name));
  const portNames = joinNames(enquiry.ports?.map((p) => p.port_name ?? p.name));
  const cruiseLineNames = joinNames(enquiry.cruiseLines?.map((c) => c.cruise_line_name ?? c.name));
  const cruiseDestinationNames = joinNames(enquiry.cruiseDestinations?.map((c) => c.cruise_destination_name ?? c.name));

  const passengerParts: string[] = [];
  if (enquiry.adults) passengerParts.push(`${enquiry.adults} Adult${enquiry.adults === 1 ? "" : "s"}`);
  if (enquiry.children) passengerParts.push(`${enquiry.children} Child${enquiry.children === 1 ? "" : "ren"}`);
  if (enquiry.infants) passengerParts.push(`${enquiry.infants} Infant${enquiry.infants === 1 ? "" : "s"}`);

  const nights =
    Array.isArray(enquiry.flexible_nights) && enquiry.flexible_nights.length > 0
      ? `${enquiry.flexible_nights.join(", ")} nights`
      : enquiry.no_of_nights
        ? `${enquiry.no_of_nights} night${enquiry.no_of_nights === 1 ? "" : "s"}`
        : null;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return {
    left: [
      { key: "holiday-type", icon: "package-plus", label: "Holiday Type", value: enquiry.holiday_type_name || null },
      { key: "travel-date", icon: "calendar-days", label: isCruise ? "Cruise Date" : "Travel Date", value: enquiry.travel_date ? formatUKDate(enquiry.travel_date) : null },
      { key: "flexibility", icon: "calendar-range", label: "Flexibility", value: enquiry.flexibility_date || enquiry.flexible_date || null },
      { key: "no-nights", icon: "moon-star", label: "No. Nights", value: nights },
      { key: "departure-airport", icon: "plane-takeoff", label: "Departure Airport", value: isStandard ? airportNames : null },
      { key: "departure-port", icon: "anchor", label: "Departure Port", value: isCruise ? portNames : null },
      { key: "destination", icon: "map-pin", label: "Destination", value: isCruise ? null : destinationNames },
      { key: "cruise-destinations", icon: "globe", label: "Cruise Destinations", value: isCruise ? (cruiseDestinationNames ?? destinationNames) : null },
      { key: "resort", icon: "hotel", label: "Resort", value: isCruise ? null : resortNames },
      { key: "weekend-lodge", icon: "hotel", label: "Weekend Lodge", value: isHotTub ? enquiry.weekend_lodge || null : null },
      { key: "cruise-line", icon: "ship", label: "Cruise Line", value: isCruise ? cruiseLineNames : null },
    ],
    right: [
      { key: "no-guests", icon: "users", label: "Guests", value: isHotTub && enquiry.no_of_guests ? plural(enquiry.no_of_guests, "guest") : null },
      { key: "no-passengers", icon: "users", label: "No. Passengers", value: isHotTub ? null : passengerParts.length ? passengerParts.join(", ") : null },
      { key: "pets", icon: "dog", label: "Pets", value: isHotTub && enquiry.no_of_pets != null ? plural(enquiry.no_of_pets, "pet") : null },
      { key: "cabin-type", icon: "bed-double", label: "Cabin Type", value: isCruise ? enquiry.cabin_type || null : null },
      { key: "pre-cruise", icon: "moon-star", label: "Pre-Cruise Stay", value: isCruise && enquiry.pre_cruise_stay != null ? plural(enquiry.pre_cruise_stay, "night") : null },
      { key: "post-cruise", icon: "moon-star", label: "Post-Cruise Stay", value: isCruise && enquiry.post_cruise_stay != null ? plural(enquiry.post_cruise_stay, "night") : null },
      { key: "board-basis", icon: "utensils", label: "Board Basis", value: isStandard ? boardBasisNames : null },
      { key: "star-rating", icon: "star", label: "Min Star Rating", value: isStandard ? enquiry.accom_min_star_rating || null : null },
      { key: "budget", icon: "badge-pound-sterling", label: "Budget", value: enquiry.budget ? `${currency.format(parseFloat(enquiry.budget))}${formatBudgetType(enquiry.budget_type)}` : null },
      { key: "assigned-agent", icon: "user-round", label: "Assigned Agent", value: agentName },
      { key: "status", icon: "tag", label: "Status", value: enquiry.status ?? null },
    ],
  };
}
