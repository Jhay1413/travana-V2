/**
 * Pure data behind "The trip, start to finish". This ports the ordering and
 * branching rules of QuoteSummaryTimeline (hot-tub lodge stays, cruises that
 * skip the transfer, sort keys, inbound fall-backs) into plain objects so the
 * new card can restyle them and the rules can be unit tested.
 */
import type { QuoteDisplay } from "@/features/quote/components/quote-types";
import { formatTime24, formatTimelineDate } from "@/features/quote/components/quote-types";
import { buildTripExtras } from "./trip-extras";
import type { TripStop } from "./trip-types";

export type { TripIcon, TripStop, TripTone } from "./trip-types";
export { buildTripExtras };

type Leg = QuoteDisplay["flights"]["outbound"];

const buildSortKey = (date: string, section: string, time?: string) => `${date || "9999-12-31"}#${section}#${time || "00:00"}`;

function legHasData(leg: Leg): boolean {
  return Boolean(leg.from || leg.to || leg.departDate || leg.arriveDate || leg.flightNo);
}

function flightLines(leg: Leg): string[] {
  const lines: string[] = [];
  if (leg.departDate) lines.push(formatTimelineDate(leg.departDate));
  const ref = [leg.carrier, leg.flightNo].filter(Boolean).join(" ");
  if (ref) lines.push(ref);
  return lines;
}

function flightRoute(leg: Leg): { depart: string; arrive: string } | undefined {
  const depart = formatTime24(leg.departTime);
  const arrive = formatTime24(leg.arriveTime);
  return depart || arrive ? { depart, arrive } : undefined;
}

function landsNextDay(leg: Leg): boolean {
  return Boolean(leg.departDate && leg.arriveDate && leg.arriveDate > leg.departDate);
}

function place(q: QuoteDisplay): string {
  return [q.resortName, q.countryName].filter(Boolean).join(", ") || q.destinationName;
}

function lodgeStops(q: QuoteDisplay): TripStop[] {
  const stops: TripStop[] = [];
  const checkIn = q.checkInDate || q.travelDate;
  const checkInLines = [formatTimelineDate(checkIn)];
  if (q.nights > 0) checkInLines.push(`${q.nights} nights`);
  if (q.pets > 0) checkInLines.push(`${q.pets} pet${q.pets !== 1 ? "s" : ""}`);
  stops.push({
    id: "lodge-checkin",
    kind: "lodge-checkin",
    tone: "lodge",
    icon: "paw",
    label: "Lodge check-in",
    title: q.lodge?.type || "Lodge",
    lines: checkInLines,
    pills: [],
    sortKey: `${checkIn}T14:00`,
  });
  if (q.accommodation.property) {
    stops.push({
      id: "lodge-arrival",
      kind: "lodge-arrival",
      tone: "hotel",
      icon: "hotel",
      label: "Lodge arrival",
      title: q.accommodation.property,
      lines: [place(q)].filter(Boolean),
      pills: [],
      sortKey: `${checkIn}T15:00`,
    });
  }
  const checkout = q.returnDate || q.travelDate;
  stops.push({
    id: "lodge-checkout",
    kind: "lodge-checkout",
    tone: "return",
    icon: "paw",
    label: "Lodge checkout",
    title: formatTimelineDate(checkout),
    lines: [],
    pills: [],
    sortKey: `${checkout}T10:00`,
  });
  return stops;
}

function connectingStops(q: QuoteDisplay, legs: Leg[], direction: "out" | "in", firstNumber: number): TripStop[] {
  const inbound = direction === "in";
  const base = inbound ? q.flights.inbound : q.flights.outbound;
  const fallbackDate = inbound ? base.departDate || q.returnDate : base.departDate;
  return legs.map((leg, i) => ({
    id: `${inbound ? "inbound" : "outbound"}-connecting-${i}`,
    kind: inbound ? "inbound-connecting" : "outbound-connecting",
    tone: inbound ? "return" : "out",
    icon: inbound ? "plane-return" : "plane",
    label: `Connecting flight ${firstNumber + i}`,
    title: `${leg.from} → ${leg.to}`,
    lines: flightLines(leg),
    pills: [],
    route: flightRoute(leg),
    landsNextDay: inbound && landsNextDay(leg) ? true : undefined,
    sortKey: buildSortKey(leg.departDate || fallbackDate, inbound ? "5" : "1", leg.departTime),
  }));
}

function standardStops(q: QuoteDisplay): TripStop[] {
  const stops: TripStop[] = [];
  const isCruise = q.packageType?.toLowerCase().includes("cruise");
  const ob = q.flights.outbound;
  const ib = q.flights.inbound;
  const hasOutboundPrimary = Boolean(ob.from || ob.to || ob.departDate || ob.flightNo);
  const outboundConnecting = q.flights.outboundConnecting.filter(legHasData);
  const outboundLegCount = (hasOutboundPrimary ? 1 : 0) + outboundConnecting.length;

  if (hasOutboundPrimary) {
    stops.push({
      id: "outbound",
      kind: "outbound",
      tone: "out",
      icon: "plane",
      label: "Outbound flight",
      title: `${ob.from} → ${ob.to}`,
      lines: flightLines(ob),
      pills: [],
      route: flightRoute(ob),
      sortKey: buildSortKey(ob.departDate, "0", ob.departTime),
    });
  }
  stops.push(...connectingStops(q, outboundConnecting, "out", (hasOutboundPrimary ? 1 : 0) + 1));

  if (q.transferType && !isCruise) {
    const date = q.checkInDate || q.travelDate || ob.departDate;
    stops.push({
      id: "transfer",
      kind: "transfer",
      tone: "transfer",
      icon: "bus",
      label: "Transfer",
      title: q.transferType,
      lines: [`${ob.to || "Airport"} → ${q.accommodation.property || q.destinationName}`],
      pills: [],
      sortKey: buildSortKey(date, "2", q.checkInTime || "14:00"),
    });
  }

  if (isCruise && q.cruise) {
    const cruiseDate = q.cruise.cruiseDate || q.travelDate;
    stops.push({
      id: "cruise-embarkation",
      kind: "cruise-embarkation",
      tone: "cruise",
      icon: "anchor",
      label: "Cruise embarkation",
      title: q.cruise.ship || q.cruise.cruiseLine,
      lines: [formatTimelineDate(cruiseDate), q.cruise.cruiseName].filter(Boolean),
      pills: [q.cruise.cabinType].filter(Boolean),
      sortKey: buildSortKey(cruiseDate, "3", "00:00"),
    });
  }

  if (q.accommodation.property) {
    const checkIn = q.checkInDate || q.travelDate;
    const time = q.checkInTime || "14:00";
    const lines = [`${formatTimelineDate(checkIn)} at ${formatTime24(time)}`, place(q)].filter(Boolean);
    if (q.nights > 0) lines.push(`${q.nights} nights`);
    stops.push({
      id: "hotel",
      kind: "hotel",
      tone: "hotel",
      icon: "hotel",
      label: q.nights > 0 ? `Hotel check-in, ${q.nights} nights` : "Hotel check-in",
      title: q.accommodation.property,
      lines,
      pills: [q.accommodation.roomType, q.accommodation.board].filter(Boolean),
      sortKey: buildSortKey(checkIn, "3", time),
    });
  }

  q.extraAccommodations.forEach((a, i) => {
    if (!a.property && !a.checkInDate) return;
    const date = a.checkInDate || q.checkInDate || q.travelDate;
    const lines: string[] = [];
    if (a.checkInDate) lines.push(formatTimelineDate(a.checkInDate));
    if (a.noOfNights != null) lines.push(`${a.noOfNights} night${a.noOfNights !== 1 ? "s" : ""}`);
    if (a.tourOperatorName) lines.push(a.tourOperatorName);
    stops.push({
      id: `hotel-extra-${i}`,
      kind: "hotel-extra",
      tone: "hotel",
      icon: "hotel",
      label: "Hotel check-in",
      title: a.property,
      lines,
      pills: [a.roomType, a.board].filter(Boolean),
      sortKey: buildSortKey(date, "3", "14:00"),
    });
  });

  const hasInboundPrimary = Boolean(ib.from || ib.to || ib.departDate || q.returnDate);
  if (hasInboundPrimary) {
    const date = ib.departDate || q.returnDate;
    stops.push({
      id: "inbound",
      kind: "inbound",
      tone: "return",
      icon: "plane-return",
      label: "Return flight",
      title: `${ib.from || ob.to || ""} → ${ib.to || ob.from || ""}`,
      lines: [formatTimelineDate(date), [ib.carrier, ib.flightNo].filter(Boolean).join(" ")].filter(Boolean),
      pills: [],
      route: flightRoute(ib),
      landsNextDay: landsNextDay(ib) ? true : undefined,
      sortKey: buildSortKey(date, "4", ib.departTime),
    });
  }
  const inboundConnecting = q.flights.inboundConnecting.filter(legHasData);
  stops.push(...connectingStops(q, inboundConnecting, "in", outboundLegCount + (hasInboundPrimary ? 1 : 0) + 1));

  if (q.flightMeals === "Yes" || q.preBookedSeats) {
    stops.push({
      id: "flight-extras",
      kind: "flight-extras",
      tone: "out",
      icon: "plane",
      label: "Flight extras",
      title: "Meals and seats",
      lines: [`Flight meals: ${q.flightMeals === "Yes" ? "Yes" : "No"}`, `Pre-booked seats: ${q.preBookedSeats || "No"}`],
      pills: [],
      sortKey: "9999-12-31#9#23:59",
    });
  }
  return stops;
}

/** The ordered itinerary stops for a quote or booking. Empty when nothing has been added. */
export function buildTripStops(q: QuoteDisplay): TripStop[] {
  const isHotTub = q.packageType?.toLowerCase().includes("hot tub");
  const stops = isHotTub ? lodgeStops(q) : standardStops(q);
  return stops.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}
