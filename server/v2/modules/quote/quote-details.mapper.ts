import type { InsertQuote, InsertQuoteFlight, InsertQuoteAccomodation } from "@shared/schema";

// Pure mappers that turn a saved quote (the shape returned by
// newQuoteRepository.findWithDetails) back into create-payload-shaped sections.
// Shared by duplicateQuote and the "un-ticked not-for-social" free-copy path so the
// mapping lives in one place.

type Row = Record<string, unknown>;

/** The subset of findWithDetails' result these mappers read. */
export interface QuoteDetailsLike {
  tags?: string[];
  flights?: Row[];
  accommodations?: Row[];
  transfers?: Row[];
  carHires?: Row[];
  attractionTickets?: Row[];
  loungePasses?: Row[];
  airportParkings?: Row[];
  cruises?: Row[];
  passengers?: Row[];
}

/** Section rows that are the same shape whether duplicated or copied to social. */
export function mapQuoteExtrasFromDetails(details: QuoteDetailsLike) {
  return {
    transfers: (details.transfers || []).map((t: Row) => ({ booking_ref: t.booking_ref, tour_operator_id: t.tour_operator_id, pick_up_location: t.pick_up_location, drop_off_location: t.drop_off_location, pick_up_time: t.pick_up_time, drop_off_time: t.drop_off_time, note: t.note, cost: t.cost, commission: t.commission, is_included_in_package: t.is_included_in_package })),
    carHires: (details.carHires || []).map((c: Row) => ({ booking_ref: c.booking_ref, tour_operator_id: c.tour_operator_id, pick_up_location: c.pick_up_location, drop_off_location: c.drop_off_location, pick_up_time: c.pick_up_time, drop_off_time: c.drop_off_time, no_of_days: c.no_of_days, driver_age: c.driver_age, cost: c.cost, commission: c.commission, is_included_in_package: c.is_included_in_package })),
    attractionTickets: (details.attractionTickets || []).map((t: Row) => ({ booking_ref: t.booking_ref, tour_operator_id: t.tour_operator_id, ticket_type: t.ticket_type, date_of_visit: t.date_of_visit, number_of_tickets: t.number_of_tickets, cost: t.cost, commission: t.commission, is_included_in_package: t.is_included_in_package })),
    loungePasses: (details.loungePasses || []).map((p: Row) => ({ booking_ref: p.booking_ref, tour_operator_id: p.tour_operator_id, airport_id: p.airport_id, terminal: p.terminal, date_of_usage: p.date_of_usage, note: p.note, cost: p.cost, commission: p.commission, is_included_in_package: p.is_included_in_package })),
    airportParkings: (details.airportParkings || []).map((p: Row) => ({ booking_ref: p.booking_ref, tour_operator_id: p.tour_operator_id, airport_id: p.airport_id, parking_type: p.parking_type, parking_date: p.parking_date, car_make: p.car_make, car_model: p.car_model, colour: p.colour, car_reg_number: p.car_reg_number, duration: p.duration, cost: p.cost, commission: p.commission, is_included_in_package: p.is_included_in_package })),
    extraAccommodations: (details.accommodations || []).filter((a: Row) => !a.is_primary).map((a: Row) => ({ booking_ref: a.booking_ref, tour_operator_id: a.tour_operator_id, accomodation_id: a.accomodation_id, board_basis_id: a.board_basis_id, room_type: a.room_type, check_in_date_time: a.check_in_date_time, no_of_nights: a.no_of_nights, cost: a.cost, commission: a.commission, is_included_in_package: a.is_included_in_package })),
  };
}

/** Ages of the child passengers saved against the quote. */
export function mapChildAgesFromDetails(details: QuoteDetailsLike): number[] {
  return (details.passengers || [])
    .filter((p: Row) => p.type === "child")
    .map((p: Row) => Number(p.age) || 0);
}

function omitKeys(row: Row, keys: readonly string[]): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (!keys.includes(k)) out[k] = v;
  }
  return out;
}

const FLIGHT_IDENTITY_KEYS = ["id", "quote_id", "leg_order", "departing_airport_name", "arrival_airport_name", "tour_operator_name"] as const;

function flightLegs(flights: Row[], type: "outbound" | "inbound") {
  const ofType = flights.filter((f) => f.flight_type === type);
  const first = ofType.find((f) => Number(f.leg_order ?? 0) === 0);
  const connecting = ofType
    .filter((f) => Number(f.leg_order ?? 0) > 0)
    .sort((a, b) => Number(a.leg_order) - Number(b.leg_order))
    .map((f) => omitKeys(f, FLIGHT_IDENTITY_KEYS) as Partial<InsertQuoteFlight>);
  return {
    flight: first ? (omitKeys(first, FLIGHT_IDENTITY_KEYS) as Partial<InsertQuoteFlight>) : undefined,
    connecting,
  };
}

// The cruise persistence payload (see buildCruiseData in quote.service) rebuilt from the
// saved quote_cruise row, or null when the quote has no cruise.
function cruiseDataFromDetails(details: QuoteDetailsLike): Row | null {
  const c = details.cruises?.[0];
  if (!c) return null;
  const extras = Array.isArray(c.extras) ? (c.extras as Row[]) : [];
  const itinerary = Array.isArray(c.itinerary) ? (c.itinerary as Row[]) : [];
  return {
    cruiseTitle: c.cruise_name ?? undefined,
    cruiseLine: c.cruise_line ?? undefined,
    shipName: c.ship ?? undefined,
    cruiseDate: c.cruise_date ?? undefined,
    cabinType: c.cabin_type ?? undefined,
    cabinNumber: c.cabin_number ?? undefined,
    embarkation: c.embarkation ?? undefined,
    debarkation: c.debarkation ?? undefined,
    cruiseExtras: extras.map((e) => String(e.name ?? "").trim()).filter((n) => n.length > 0).join(", "),
    cruiseItinerary: itinerary.map((d) => ({ day: d.day_number, description: d.description, subDescription: d.sub_description })),
    preCruiseStay: c.pre_cruise_stay,
    postCruiseStay: c.post_cruise_stay,
    tourOperatorId: c.tour_operator_id ?? null,
  };
}

// The quote columns a free social copy inherits. A whitelist on purpose: per-quote
// identity (id, quote_token, sent/accepted marks, parent_quote_id), deletion marks and
// portal/featured flags must never leak onto the copy.
const COPIED_QUOTE_COLUMNS = [
  "holiday_type_id", "sales_price", "package_commission", "travel_date", "discounts", "service_charge",
  "num_of_nights", "pets", "cottage_id", "lodge_id", "quote_type", "deal_type", "pre_booked_seats",
  "flight_meals", "infant", "child", "adult", "title", "price_per_person", "lodge_type", "transfer_type",
  "main_tour_operator_id", "quote_ref", "date_expiry",
] as const;

export interface FreeSocialCopySections {
  outboundFlight?: Partial<InsertQuoteFlight>;
  inboundFlight?: Partial<InsertQuoteFlight>;
  outboundConnectingLegs: Partial<InsertQuoteFlight>[];
  inboundConnectingLegs: Partial<InsertQuoteFlight>[];
  primaryAccommodation?: Partial<InsertQuoteAccomodation>;
  transfers: Row[];
  carHires: Row[];
  attractionTickets: Row[];
  loungePasses: Row[];
  airportParkings: Row[];
  extraAccommodations: Row[];
  cruiseData: Row | null;
  childAges: number[];
  normalizedImages: string[];
  tags: string[];
}

/**
 * Builds the quote columns and section data for a free social copy from a saved quote.
 * `saved` is the quote row AFTER any update; `details` is its findWithDetails result.
 */
export function buildFreeSocialCopyInput(
  saved: Pick<InsertQuote, "transaction_id"> & Record<string, unknown>,
  details: QuoteDetailsLike,
  imageUrls: string[],
): { quoteFields: InsertQuote; sections: FreeSocialCopySections } {
  const quoteFields: Row = { transaction_id: saved.transaction_id, quote_status: "quoted", not_for_social: false };
  for (const key of COPIED_QUOTE_COLUMNS) quoteFields[key] = saved[key];

  const flights = details.flights || [];
  const outbound = flightLegs(flights, "outbound");
  const inbound = flightLegs(flights, "inbound");
  const primary = (details.accommodations || []).find((a) => a.is_primary);

  return {
    quoteFields: quoteFields as unknown as InsertQuote,
    sections: {
      outboundFlight: outbound.flight,
      inboundFlight: inbound.flight,
      outboundConnectingLegs: outbound.connecting,
      inboundConnectingLegs: inbound.connecting,
      primaryAccommodation: primary
        ? (omitKeys(primary, ["id", "quote_id", "accomodation_name", "board_basis_name", "tour_operator_name", "room_type_name", "resort_id", "resort_name", "destination_id", "destination_name", "country_id", "country_name"]) as Partial<InsertQuoteAccomodation>)
        : undefined,
      ...mapQuoteExtrasFromDetails(details),
      cruiseData: cruiseDataFromDetails(details),
      childAges: mapChildAgesFromDetails(details),
      normalizedImages: imageUrls,
      tags: details.tags ?? [],
    },
  };
}
