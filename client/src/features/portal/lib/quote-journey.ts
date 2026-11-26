import type { PortalBookingExtra } from "@shared/portal-bookings";
import type { PortalQuoteDetail, PortalQuoteDetailFlight } from "@shared/portal-quotes";
import { formatClock, formatDay } from "./quote-format";

export type JourneyKind = "flight-out" | "flight-in" | "flight" | "transfer" | "hotel" | "cruise" | "car-hire" | "tickets" | "lounge" | "parking" | "extra";

export interface JourneyFlight {
  from: string;
  to: string;
  dep: string;
  arr: string;
  /** The flight lands on a later calendar day than it left. */
  nextDay: boolean;
}

export interface JourneyItem {
  /** Stable React key. */
  key: string;
  kind: JourneyKind;
  kicker: string;
  title: string;
  /** Lines of plain detail under the title. */
  detail: string[];
  flight?: JourneyFlight;
  /** The sort key (YYYY-MM-DDTHH:mm) the item was placed by. */
  sortKey: string;
}

/** A time of day to assume for an item that has a date but no time, so same-day items fall in a sensible order. */
const DEFAULT_TIME: Record<JourneyKind, string> = {
  extra: "23:59",
  parking: "04:00",
  lounge: "05:00",
  "flight-out": "06:00",
  flight: "06:30",
  transfer: "10:00",
  "car-hire": "11:00",
  cruise: "12:00",
  tickets: "12:00",
  hotel: "15:00",
  "flight-in": "16:00",
};

/** Items that happen on the way home fall back to the return date when they have no date of their own. */
const HOMEWARD: ReadonlySet<JourneyKind> = new Set<JourneyKind>(["flight-in"]);

const FAR_FUTURE = "9999-12-31";

/** What the journey is built from: the itinerary items every quote and booking carries (both detail types fit). */
export type JourneySource = Pick<
  PortalQuoteDetail,
  "travelDate" | "returnDate" | "flights" | "accommodations" | "transfers" | "carHires" | "attractionTickets" | "loungePasses" | "airportParkings" | "cruises"
> & {
  numNights: number | null;
  /** Extras bought for a booking: they have no travel date, so they close the timeline. */
  extras?: PortalBookingExtra[];
};

interface Draft extends Omit<JourneyItem, "sortKey"> {
  /** The item's own date-time, if it has one. */
  at: string | null;
}

function sortKeyFor(d: Draft, travelDate: string | null, returnDate: string | null): string {
  if (d.kind === "extra") return `${FAR_FUTURE}T${DEFAULT_TIME.extra}`;
  const own = d.at && /^\d{4}-\d{2}-\d{2}/.exec(d.at) ? d.at : null;
  const day = own ? own.slice(0, 10) : (HOMEWARD.has(d.kind) ? returnDate : travelDate)?.slice(0, 10) ?? FAR_FUTURE;
  const time = own && /T\d{2}:\d{2}/.test(own) ? own.slice(11, 16) : DEFAULT_TIME[d.kind];
  return `${day}T${time}`;
}

const dateLine = (label: string, value: string | null): string => {
  const day = formatDay(value);
  return day ? `${label} ${day}` : "";
};

function flightDraft(f: PortalQuoteDetailFlight, index: number, legsInDirection: number): Draft {
  const kind: JourneyKind = f.flightType === "outbound" ? "flight-out" : f.flightType === "inbound" ? "flight-in" : "flight";
  const base = kind === "flight-out" ? "Outbound flight" : kind === "flight-in" ? "Return flight" : "Flight";
  const kicker = legsInDirection > 1 && f.legOrder ? `${base}, leg ${f.legOrder}` : base;
  const dep = formatClock(f.departureDateTime);
  const arr = formatClock(f.arrivalDateTime);
  const nextDay = !!(f.departureDateTime && f.arrivalDateTime && f.arrivalDateTime.slice(0, 10) > f.departureDateTime.slice(0, 10));
  const detail = [[formatDay(f.departureDateTime), f.flightNumber].filter(Boolean).join(" · ")].filter(Boolean);
  return {
    key: `flight-${index}`,
    kind,
    kicker,
    title: `${f.departingAirport || "To be confirmed"} to ${f.arrivalAirport || "to be confirmed"}`,
    detail: nextDay ? [...detail, "Lands the next day"] : detail,
    flight: { from: f.departingAirport, to: f.arrivalAirport, dep, arr, nextDay },
    at: f.departureDateTime,
  };
}

/**
 * Everything the quote includes, as one ordered timeline: every flight leg, transfer, hotel, cruise, car hire,
 * ticket, lounge pass and parking booking, in date order (a booking's extras come last). An item without a date is placed by what it is
 * (outward items on the first day, the return flight on the last), so nothing is dropped for lacking a date.
 */
export function buildJourney(q: JourneySource): JourneyItem[] {
  const drafts: Draft[] = [];

  const outLegs = q.flights.filter((f) => f.flightType === "outbound").length;
  const inLegs = q.flights.filter((f) => f.flightType === "inbound").length;
  q.flights.forEach((f, i) => drafts.push(flightDraft(f, i, f.flightType === "inbound" ? inLegs : outLegs)));

  q.transfers.forEach((t, i) =>
    drafts.push({
      key: `transfer-${i}`,
      kind: "transfer",
      kicker: "Transfer",
      title: `${t.from || "Pick-up"} to ${t.to || "drop-off"}`,
      detail: [dateLine("Pick-up", t.pickUpTime), t.note].filter(Boolean),
      at: t.pickUpTime,
    }),
  );

  q.accommodations.forEach((a, i) =>
    drafts.push({
      key: `hotel-${i}`,
      kind: "hotel",
      kicker: q.accommodations.length === 1 && (q.numNights ?? 0) > 0 ? `Hotel, ${q.numNights} night${q.numNights === 1 ? "" : "s"}` : "Hotel",
      title: a.name || "Accommodation",
      detail: [dateLine("Check in", a.checkInDateTime), [a.roomType, a.boardBasis].filter(Boolean).join(" · ")].filter(Boolean),
      at: a.checkInDateTime,
    }),
  );

  q.cruises.forEach((c, i) =>
    drafts.push({
      key: `cruise-${i}`,
      kind: "cruise",
      kicker: "Cruise",
      title: c.cruiseName || c.ship || "Cruise",
      detail: [
        [c.cruiseLine, c.ship].filter(Boolean).join(" · "),
        c.cabinType ? `Cabin: ${c.cabinType}` : "",
        dateLine("Sails", c.cruiseDate),
        ...c.itinerary.map((d) => `Day ${d.day}: ${[d.description, d.subDescription].filter(Boolean).join(", ")}`),
      ].filter(Boolean),
      at: c.cruiseDate,
    }),
  );

  q.carHires.forEach((c, i) =>
    drafts.push({
      key: `car-${i}`,
      kind: "car-hire",
      kicker: "Car hire",
      title: [c.pickupLocation, c.dropoffLocation].filter(Boolean).join(" to ") || "Car hire",
      detail: [c.numDays > 0 ? `${c.numDays} day${c.numDays === 1 ? "" : "s"}` : "", dateLine("Pick-up", c.pickupTime)].filter(Boolean),
      at: c.pickupTime,
    }),
  );

  q.attractionTickets.forEach((t, i) =>
    drafts.push({
      key: `ticket-${i}`,
      kind: "tickets",
      kicker: "Tickets and attractions",
      title: t.type || "Attraction tickets",
      detail: [t.numberOfTickets > 0 ? `${t.numberOfTickets} ticket${t.numberOfTickets === 1 ? "" : "s"}` : "", dateLine("Visit", t.dateOfVisit)].filter(Boolean),
      at: t.dateOfVisit,
    }),
  );

  q.loungePasses.forEach((l, i) =>
    drafts.push({
      key: `lounge-${i}`,
      kind: "lounge",
      kicker: "Airport lounge",
      title: l.airportName || "Lounge pass",
      detail: [l.terminal ? `Terminal ${l.terminal}` : "", dateLine("Use on", l.dateOfUsage), l.note].filter(Boolean),
      at: l.dateOfUsage,
    }),
  );

  q.airportParkings.forEach((p, i) =>
    drafts.push({
      key: `parking-${i}`,
      kind: "parking",
      kicker: "Airport parking",
      title: p.airportName || "Airport parking",
      detail: [p.parkingType, dateLine("From", p.parkingDate)].filter(Boolean),
      at: p.parkingDate,
    }),
  );

  (q.extras ?? []).forEach((e, i) =>
    drafts.push({
      key: `extra-${i}`,
      kind: "extra",
      kicker: e.type || "Extra",
      title: e.description || e.type || "Extra",
      detail: e.quantity > 1 ? [`Quantity ${e.quantity}`] : [],
      at: null,
    }),
  );

  return drafts
    .map((d, index) => ({ d, index, sortKey: sortKeyFor(d, q.travelDate, q.returnDate) }))
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : a.index - b.index))
    .map(({ d, sortKey }) => {
      const { at: _at, ...item } = d;
      return { ...item, sortKey };
    });
}
