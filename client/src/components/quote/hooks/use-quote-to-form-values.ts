import { useMemo } from "react";

/**
 * Transforms a fetched quote into the field shape expected by the
 * QuoteCreateDialog form (used for the Copy/Edit flows). Pure transform —
 * no side effects, no mutations.
 */
export function useQuoteToFormValues(quoteData: any) {
  return useMemo(() => {
    if (!quoteData) return {};

    const flights = quoteData.flights || [];
    const accommodations = quoteData.accommodations || [];
    const primaryAccom = accommodations.find((a: any) => a.is_primary) || accommodations[0];

    const outboundFlights = flights
      .filter((f: any) => f.flight_type === "outbound")
      .sort((a: any, b: any) => (a.leg_order || 0) - (b.leg_order || 0));
    const inboundFlights = flights
      .filter((f: any) => f.flight_type === "inbound")
      .sort((a: any, b: any) => (a.leg_order || 0) - (b.leg_order || 0));
    const outboundFlight = outboundFlights[0];
    const inboundFlight = inboundFlights[0];

    const splitDateTime = (iso: string) => {
      if (!iso) return { date: "", time: "" };
      const [date, time] = iso.split("T");
      return { date: date || "", time: time ? time.slice(0, 5) : "" };
    };

    const obDepart = splitDateTime(outboundFlight?.departure_date_time || "");
    const obArrive = splitDateTime(outboundFlight?.arrival_date_time || "");
    const ibDepart = splitDateTime(inboundFlight?.departure_date_time || "");
    const ibArrive = splitDateTime(inboundFlight?.arrival_date_time || "");
    const checkIn = splitDateTime(primaryAccom?.check_in_date_time || "");

    const childPassengers = (quoteData.passengers || []).filter((p: any) => p.type === "child");

    return {
      packageType: quoteData.holiday_type_id || "",
      quoteTitle: quoteData.title || "",
      quoteLink: quoteData.quote_ref || "",
      leadSource: quoteData.lead_source || "",
      status: "QUOTE_IN_PROGRESS",
      tourOperatorId: quoteData.main_tour_operator_id || "",
      travelDate: quoteData.travel_date || "",
      nights: quoteData.num_of_nights || 7,
      passengersAdults: quoteData.adult || 2,
      passengersChildren: quoteData.child || 0,
      passengersInfants: quoteData.infant || 0,
      childAges: childPassengers.map((p: any) => p.age || 0),
      transferType: quoteData.transfer_type || "",
      preBookedSeats: quoteData.pre_booked_seats || "",
      flightMeals: quoteData.flight_meals ? "Yes" : "No",
      country: quoteData.country_id || "",
      destination: quoteData.destination_id || "",
      resort: quoteData.resort_id || "",
      accommodationId: primaryAccom?.accomodation_id || "",
      boardBasisId: primaryAccom?.board_basis_id || "",
      checkInDate: checkIn.date,
      checkInTime: checkIn.time,
      roomType: primaryAccom?.room_type || "",
      outboundDepartAirportId: outboundFlight?.departing_airport_id || "",
      outboundArriveAirportId: outboundFlight?.arrival_airport_id || "",
      outboundDepartDate: obDepart.date,
      outboundDepartTime: obDepart.time,
      outboundArriveDate: obArrive.date,
      outboundArriveTime: obArrive.time,
      outboundFlightNumber: outboundFlight?.flight_number || "",
      outboundConnectingLegs: outboundFlights.slice(1).map((f: any) => {
        const dep = splitDateTime(f.departure_date_time || "");
        const arr = splitDateTime(f.arrival_date_time || "");
        return {
          departAirportId: f.departing_airport_id || "",
          departAirport: f.departing_airport_name || "",
          arriveAirportId: f.arrival_airport_id || "",
          arriveAirport: f.arrival_airport_name || "",
          departDate: dep.date,
          departTime: dep.time,
          arriveDate: arr.date,
          arriveTime: arr.time,
          flightNumber: f.flight_number || "",
        };
      }),
      inboundDepartAirportId: inboundFlight?.departing_airport_id || "",
      inboundArriveAirportId: inboundFlight?.arrival_airport_id || "",
      inboundDepartDate: ibDepart.date,
      inboundDepartTime: ibDepart.time,
      inboundArriveDate: ibArrive.date,
      inboundArriveTime: ibArrive.time,
      inboundFlightNumber: inboundFlight?.flight_number || "",
      inboundConnectingLegs: inboundFlights.slice(1).map((f: any) => {
        const dep = splitDateTime(f.departure_date_time || "");
        const arr = splitDateTime(f.arrival_date_time || "");
        return {
          departAirportId: f.departing_airport_id || "",
          departAirport: f.departing_airport_name || "",
          arriveAirportId: f.arrival_airport_id || "",
          arriveAirport: f.arrival_airport_name || "",
          departDate: dep.date,
          departTime: dep.time,
          arriveDate: arr.date,
          arriveTime: arr.time,
          flightNumber: f.flight_number || "",
        };
      }),
      lodgeId: quoteData.lodge_id || "",
      parkId: "",
      pets: quoteData.pets ?? 0,
      cruiseTitle: quoteData.cruises?.[0]?.cruise_name || "",
      cruiseLine: quoteData.cruises?.[0]?.cruise_line || "",
      shipName: quoteData.cruises?.[0]?.ship || "",
      cruiseDate: quoteData.cruises?.[0]?.cruise_date || "",
      cabinType: quoteData.cruises?.[0]?.cabin_type || "",
      embarkation: "",
      debarkation: "",
      cruiseExtras: "",
      cruiseOnly: false,
      price: parseFloat(quoteData.sales_price || "0"),
      commission: parseFloat(quoteData.package_commission || "0"),
      discount: parseFloat(quoteData.discounts || "0"),
      serviceCharge: parseFloat(quoteData.service_charge || "0"),
      pricePerPerson: 0,
      tags: quoteData.tags || [],
      not_for_social: quoteData.not_for_social ?? false,
    };
  }, [quoteData]);
}
