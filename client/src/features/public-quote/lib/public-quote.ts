/** Pure helpers for the public quote page (`/view-quote/:token`): everything is built from the public payload, nothing is invented. */
import type { PortalBranding } from "@/features/portal";
import { formatRange, paxLabel, uniqueNames } from "@/features/portal/lib/quote-format";
import { buildJourney, type JourneyItem, type JourneySource } from "@/features/portal/lib/quote-journey";
import type { AgencyContact, PublicQuoteData } from "@/features/quote/api/use-quote-public-queries";

/** The agency the page is for, in the shape the portal's header, footer and mark take. Never a fixed brand. */
export function agencyToBranding(agency: AgencyContact): PortalBranding {
  return {
    name: agency.name,
    logoUrl: agency.logoUrl,
    iconUrl: agency.iconUrl,
    brandColor: null,
    phone: agency.phone,
    email: agency.email,
    address: agency.address,
  };
}

/** Where "I'm interested" goes: the portal's sign-in, which then opens this quote with its real decision buttons. */
export function interestedHref(token: string): string {
  return `/portal/login?next=${encodeURIComponent(`/portal/quote/${token}`)}`;
}

/** `tel:` link for a phone number as an agency typed it ("0191 594 7999"). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** The first `YYYY-MM-DD` in a stored date or date-time, or null. Read as written, so no time zone can move the day. */
function dayPart(value: string | null | undefined): string | null {
  const match = value ? /^(\d{4}-\d{2}-\d{2})/.exec(value) : null;
  return match ? match[1] : null;
}

/** The day the holiday ends: the travel date plus the nights, as `YYYY-MM-DD`; null when either is unknown. */
export function returnDay(travelDate: string | null, nights: number): string | null {
  const start = dayPart(travelDate);
  if (!start || !(nights > 0)) return null;
  const [y, m, d] = start.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + nights)).toISOString().slice(0, 10);
}

/** The public payload as the portal's journey builder reads a quote (fields the public payload does not carry are blank). */
export function toJourneySource(q: PublicQuoteData): JourneySource {
  return {
    travelDate: dayPart(q.travelDate),
    returnDate: returnDay(q.travelDate, q.numNights),
    numNights: q.numNights,
    flights: q.flights,
    accommodations: q.accommodations.map((a) => ({
      name: a.name,
      boardBasis: a.boardBasis,
      roomType: a.roomType,
      checkInDateTime: a.checkInDateTime,
      resortName: q.resortName,
    })),
    transfers: q.transfers.map((t) => ({ from: t.from, to: t.to, pickUpTime: null, dropOffTime: null, note: t.note })),
    carHires: q.carHires.map((c) => ({ ...c, pickupTime: null, dropoffTime: null })),
    attractionTickets: q.attractionTickets,
    loungePasses: q.loungePasses.map((l) => ({ ...l, note: "" })),
    airportParkings: q.airportParkings,
    cruises: q.cruises,
  };
}

/** "4-star hotel" for a rating such as "4" or "4 stars"; "" when it has none. */
export function starLine(rating: string | null | undefined): string {
  const n = parseInt(rating ?? "", 10);
  return Number.isFinite(n) && n > 0 ? `${n}-star hotel` : "";
}

/**
 * Everything the quote includes in date order, as the portal shows it, plus what only the public page carried:
 * a hotel's star rating goes under its other lines.
 */
export function buildPublicJourney(q: PublicQuoteData): JourneyItem[] {
  return buildJourney(toJourneySource(q)).map((item) => {
    const match = /^hotel-(\d+)$/.exec(item.key);
    const stars = match ? starLine(q.accommodations[Number(match[1])]?.starRating) : "";
    return stars ? { ...item, detail: [...item.detail, stars] } : item;
  });
}

/** Total as the old page showed it: "£1,234.00"; "" when the quote has no usable total. */
export function formatTotal(value: string | number | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n) || n <= 0) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

/** The label/value rows of "Everything, at a glance."; rows with no value are left out. */
export function publicDetails(q: PublicQuoteData): Array<{ label: string; value: string }> {
  const outbound = q.flights.find((f) => f.flightType === "outbound") ?? q.flights[0];
  const hotels = uniqueNames(q.accommodations.map((a) => a.name));
  const first = q.accommodations[0];
  const pax = paxLabel(q.adults, q.children, q.infants);
  const transfer = q.transferType && q.transferType.toLowerCase() !== "none" ? q.transferType : "";
  const passengers = pax ? pax.charAt(0).toUpperCase() + pax.slice(1) + (q.pets > 0 ? `, ${q.pets} pet${q.pets === 1 ? "" : "s"}` : "") : "";
  const items = [
    { label: "Travel dates", value: formatRange(dayPart(q.travelDate), returnDay(q.travelDate, q.numNights)) },
    { label: "Departure airport", value: outbound?.departingAirport ?? "" },
    { label: hotels.length > 1 ? "Hotels" : "Hotel", value: hotels.join(", ") },
    { label: "Room", value: first?.roomType ?? "" },
    { label: "Board", value: first?.boardBasis ?? "" },
    { label: "Nights", value: q.numNights > 0 ? `${q.numNights} night${q.numNights === 1 ? "" : "s"}` : "" },
    { label: "Passengers", value: passengers },
    { label: "Transfer", value: transfer },
    { label: "In-flight meals", value: q.flightMeals ? "Included" : "" },
    { label: "Pre-booked seats", value: q.preBookedSeats ?? "" },
    { label: "Holiday type", value: q.holidayType ?? "" },
  ];
  return items.filter((i) => i.value);
}

/** The hero's place line: resort, destination and country, each once. */
export function placeLine(q: Pick<PublicQuoteData, "resortName" | "destinationName" | "countryName">): string {
  return [q.resortName, q.destinationName, q.countryName].filter((v, i, all) => v && all.indexOf(v) === i).join(" · ");
}

/** The quote's title, falling back to its place, then to a plain "Your holiday". */
export function quoteTitle(q: Pick<PublicQuoteData, "title" | "destinationName" | "countryName">): string {
  return q.title || [q.destinationName, q.countryName].filter(Boolean).join(", ") || "Your holiday";
}

/** The photos with a stable id each (the public payload has none), blank URLs dropped; the primary one leads the hero. */
export function publicPhotos(images: PublicQuoteData["images"]): { photos: Array<{ id: string; url: string }>; lead: string | undefined } {
  const valid = images.filter((i): i is { image_url: string; isPrimary: boolean | null } => !!i.image_url);
  return {
    photos: valid.map((i, idx) => ({ id: `photo-${idx}`, url: i.image_url })),
    lead: (valid.find((i) => i.isPrimary) ?? valid[0])?.image_url,
  };
}
