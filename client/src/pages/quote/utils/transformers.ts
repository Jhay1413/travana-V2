/**
 * Data Transformers for Quote Page
 * Functions that transform API data into display-ready formats.
 */

import type { EnrichedQuote, EnrichedBooking, Passenger, QuoteDisplay } from "./types";
import { splitIsoDateTime } from "./formatters";

/**
 * Transform API quote data into display format
 */
export function transformQuoteData(apiData: EnrichedQuote | EnrichedBooking): QuoteDisplay {
  console.log("🔍 Full API Data:", apiData);
  console.log("🔍 API Data lead_source:", apiData.lead_source);

  const flights = apiData.flights || [];
  const cruises = apiData.cruises || [];
  const outboundFlight = flights.find((f) => f.flight_type === "outbound") || flights[0];
  const inboundFlight = flights.find((f) => f.flight_type === "inbound") || flights[1];

  const obDepart = splitIsoDateTime(outboundFlight?.departure_date_time || "");
  const obArrive = splitIsoDateTime(outboundFlight?.arrival_date_time || "");
  const ibDepart = splitIsoDateTime(inboundFlight?.departure_date_time || "");
  const ibArrive = splitIsoDateTime(inboundFlight?.arrival_date_time || "");

  const accommodations = apiData.accommodations || [];
  const primaryAccom = accommodations.find((a) => a.is_primary) || accommodations[0];

  const travelDate = apiData.travel_date || "";
  const numNights = apiData.num_of_nights || 0;
  const returnDate = travelDate
    ? (() => {
        const d = new Date(travelDate);
        d.setDate(d.getDate() + numNights);
        return d.toISOString().split("T")[0];
      })()
    : "";

  const salesPrice = parseFloat(apiData.sales_price || "0");
  const packageCommission = parseFloat(apiData.package_commission || "0");

  const childPassengers = (apiData.passengers || []).filter((p: Passenger) => p.type === "child");

  const result: QuoteDisplay = {
    id: apiData.id,
    transaction_id: apiData.transaction_id,
    status:
      ("quote_status" in apiData
        ? apiData.quote_status
        : "booking_status" in apiData
          ? apiData.booking_status
          : null) || "draft",
    packageType:
      apiData.holiday_type_name || ("quote_type" in apiData ? apiData.quote_type : null) || "",
    quoteTitle: apiData.title || "",
    quoteLink: "",
    travelDate,
    returnDate,
    destination: apiData.destination_id || "",
    destinationName: apiData.destination_name || "",
    country: apiData.country_id || "",
    countryName: apiData.country_name || "",
    resort: apiData.resort_id || "",
    resortName: apiData.resort_name || "",
    createdAt: apiData.date_created || "",
    passengersInfants: apiData.infant || 0,
    checkInDate: primaryAccom?.check_in_date_time?.split("T")[0] || "",
    checkInTime: primaryAccom?.check_in_date_time
      ? splitIsoDateTime(primaryAccom.check_in_date_time).time
      : "",
    nights: numNights,
    transferType: apiData.transfer_type || "",
    preBookedSeats: apiData.pre_booked_seats || "",
    flightMeals: apiData.flight_meals ? "Yes" : "",
    leadSource: apiData.lead_source || "",
    tags: [],
    passengers: {
      adults: apiData.adult || 0,
      children: apiData.child || 0,
      childAges: childPassengers.map((p: Passenger) => p.age || 0),
    },
    accommodation: {
      property: primaryAccom?.accomodation_name || "",
      board: primaryAccom?.board_basis_name || "",
      roomType: primaryAccom?.room_type || "",
      notes: "",
    },
    flights: {
      outbound: {
        from: outboundFlight?.departing_airport_name || "",
        to: outboundFlight?.arrival_airport_name || "",
        carrier: "",
        flightNo: outboundFlight?.flight_number || "",
        depart: outboundFlight?.departure_date_time || "",
        arrive: outboundFlight?.arrival_date_time || "",
        departDate: obDepart.date,
        departTime: obDepart.time,
        arriveDate: obArrive.date,
        arriveTime: obArrive.time,
      },
      inbound: {
        from: inboundFlight?.departing_airport_name || "",
        to: inboundFlight?.arrival_airport_name || "",
        carrier: "",
        flightNo: inboundFlight?.flight_number || "",
        depart: inboundFlight?.departure_date_time || "",
        arrive: inboundFlight?.arrival_date_time || "",
        departDate: ibDepart.date,
        departTime: ibDepart.time,
        arriveDate: ibArrive.date,
        arriveTime: ibArrive.time,
      },
    },
    owner: {
      name: "Agent",
      role: "Agent" as const,
    },
    commissions: {
      tourOperator: apiData.main_tour_operator_name || "",
      price: salesPrice,
      commissionPercent: salesPrice > 0 ? (packageCommission / salesPrice) * 100 : 0,
      commissionValue: packageCommission,
      agentSplitPercent: 0,
      agentSplitValue: 0,
      netToAgency: packageCommission,
    },
    notes: [],
    pets: apiData.pets || 0,
    lodge:
      "lodge_type" in apiData && apiData.lodge_type
        ? { name: "", type: apiData.lodge_type || "", code: "" }
        : undefined,
    cruise:
      cruises.length > 0
        ? {
            cruiseLine: cruises[0].cruise_line || "",
            ship: cruises[0].ship || "",
            cabinType: cruises[0].cabin_type || "",
            cruiseName: cruises[0].cruise_name || "",
            cruiseDate: cruises[0].cruise_date || "",
            preCruiseStay: cruises[0].pre_cruise_stay || 0,
            postCruiseStay: cruises[0].post_cruise_stay || 0,
          }
        : undefined,
    haysRef: ("hays_ref" in apiData ? apiData.hays_ref : undefined) || undefined,
    supplierRef: ("supplier_ref" in apiData ? apiData.supplier_ref : undefined) || undefined,
  };

  console.log("✅ Transformed quote leadSource:", result.leadSource);
  return result;
}

/**
 * Build DateTime string from date and time parts
 */
export function buildDateTime(date: string | null | undefined, time: string | null | undefined): string | null {
  if (!date) return null;
  if (!time) return `${date}T00:00:00`;
  return `${date}T${time}:00`;
}
