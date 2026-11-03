import type { EnrichedQuote } from "@/features/quote/types";
import { normalizeTransferType, type QuoteFormValues } from "@/features/quote/types/quote-form.types";

/** Splits an ISO date-time into the date and HH:mm parts the quote form uses. */
export function splitDateTime(iso: string | undefined | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const t = iso.indexOf("T");
  return t === -1 ? { date: iso, time: "" } : { date: iso.substring(0, t), time: iso.substring(t + 1).substring(0, 5) };
}

type Leg = NonNullable<EnrichedQuote["flights"]>[number];

function connectingLeg(f: Leg) {
  const dep = splitDateTime(f.departure_date_time);
  const arr = splitDateTime(f.arrival_date_time);
  return {
    departAirportId: f.departing_airport_id || "",
    departAirport: "",
    arriveAirportId: f.arrival_airport_id || "",
    arriveAirport: "",
    departDate: dep.date,
    departTime: dep.time,
    arriveDate: arr.date,
    arriveTime: arr.time,
    flightNumber: f.flight_number || "",
  };
}

function money(value: unknown): number {
  return parseFloat(String(value || 0)) || 0;
}

/**
 * Form values for "Copy to client": the free social quote's content seeds a new client quote.
 * The supplier link (quote_ref) comes across too, since the client's copy is worked from the same page.
 */
export function buildCopyInitialValues(raw: EnrichedQuote): Partial<QuoteFormValues> {
  const flights = raw.flights || [];
  const byOrder = (a: Leg, b: Leg) => (a.leg_order ?? 0) - (b.leg_order ?? 0);
  const outboundFlights = flights.filter((f) => f.flight_type === "outbound").sort(byOrder);
  const inboundFlights = flights.filter((f) => f.flight_type === "inbound").sort(byOrder);
  const outbound = outboundFlights[0];
  const inbound = inboundFlights[0];
  const accommodations = raw.accommodations || [];
  const primary = accommodations.find((a) => a.is_primary) || accommodations[0];

  const outDep = splitDateTime(outbound?.departure_date_time);
  const outArr = splitDateTime(outbound?.arrival_date_time);
  const inDep = splitDateTime(inbound?.departure_date_time);
  const inArr = splitDateTime(inbound?.arrival_date_time);
  const checkIn = splitDateTime(primary?.check_in_date_time);

  return {
    packageType: raw.holiday_type_id || "",
    quoteTitle: raw.title || "",
    quoteLink: raw.quote_ref || "",
    leadSource: raw.lead_source || "",
    status: raw.quote_status || "draft",
    tourOperatorId: raw.main_tour_operator_id || "",
    travelDate: raw.travel_date?.toString().split("T")[0] || "",
    nights: raw.num_of_nights || 7,
    passengersAdults: raw.adult || 2,
    passengersChildren: raw.child || 0,
    passengersInfants: raw.infant || 0,
    transferType: normalizeTransferType(raw.transfer_type),
    preBookedSeats: raw.pre_booked_seats || "",
    flightMeals: raw.flight_meals ? "Yes" : "",
    country: raw.country_id || "",
    destination: raw.destination_id || "",
    resort: raw.resort_id || "",
    accommodationId: primary?.accomodation_id || "",
    boardBasisId: primary?.board_basis_id || "",
    checkInDate: checkIn.date,
    checkInTime: checkIn.time,
    roomType: primary?.room_type || "",
    outboundDepartAirportId: outbound?.departing_airport_id || "",
    outboundArriveAirportId: outbound?.arrival_airport_id || "",
    outboundDepartDate: outDep.date,
    outboundDepartTime: outDep.time,
    outboundArriveDate: outArr.date,
    outboundArriveTime: outArr.time,
    outboundFlightNumber: outbound?.flight_number || "",
    outboundConnectingLegs: outboundFlights.slice(1).map(connectingLeg),
    inboundDepartAirportId: inbound?.departing_airport_id || "",
    inboundArriveAirportId: inbound?.arrival_airport_id || "",
    inboundDepartDate: inDep.date,
    inboundDepartTime: inDep.time,
    inboundArriveDate: inArr.date,
    inboundArriveTime: inArr.time,
    inboundFlightNumber: inbound?.flight_number || "",
    inboundConnectingLegs: inboundFlights.slice(1).map(connectingLeg),
    parkId: raw.park_id || "",
    lodgeId: raw.lodge_id || "",
    pets: raw.pets ?? 0,
    price: money(raw.sales_price),
    commission: money(raw.package_commission),
    discount: money(raw.discounts),
    serviceCharge: money(raw.service_charge),
    pricePerPerson: money(raw.price_per_person),
  };
}
