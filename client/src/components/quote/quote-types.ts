import type { EnrichedQuote, EnrichedBooking, Passenger, EnrichedTransfer, EnrichedCarHire, EnrichedAttractionTicket, EnrichedLoungePass, EnrichedAirportParking } from "@/types/quote";

export const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function formatUKDate(input: string) {
  const datePart = input.includes("T") ? input.substring(0, 10) : input.substring(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return input;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return input;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatLeadSource(source: string | null | undefined): string {
  if (!source) return "—";
  return source.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

export function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const d = typeof date === "string"
    ? new Date(/Z|[+-]\d{2}:?\d{2}$/.test(date) ? date : date.replace(" ", "T") + "Z")
    : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function splitIsoDateTime(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const parts = iso.split("T");
  return { date: parts[0] || "", time: (parts[1] || "").slice(0, 5) };
}

export function formatTimelineDate(dateStr: string) {
  const datePart = dateStr.includes("T") ? dateStr.substring(0, 10) : dateStr.substring(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function formatTime24(timeStr: string) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

export function formatIsoDateTime(isoStr: string | null) {
  if (!isoStr) return "";
  const parts = isoStr.split("T");
  const datePart = parts[0] || "";
  const timePart = (parts[1] || "").slice(0, 5);
  const [y, m, day] = datePart.split("-");
  if (!y || !m || !day) return isoStr;
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthStr = months[parseInt(m, 10) - 1] || m;
  const d = parseInt(day, 10);
  return timePart ? `${d} ${monthStr} at ${timePart}` : `${d} ${monthStr}`;
}

export function formatTagLabel(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export type QuoteDisplay = {
  id: string;
  transaction_id: string;
  isCopyQuote: boolean;
  status: string;
  packageType: string;
  quoteTitle: string;
  quoteLink: string;
  travelDate: string;
  returnDate: string;
  destination: string;
  destinationName: string;
  country: string;
  countryName: string;
  resort: string;
  resortName: string;
  createdAt: string;
  passengersInfants: number;
  checkInDate: string;
  checkInTime: string;
  nights: number;
  transferType: string;
  preBookedSeats: string;
  flightMeals: string;
  leadSource: string;
  passengers: {
    adults: number;
    children: number;
    childAges: number[];
  };
  accommodation: {
    property: string;
    board: string;
    roomType: string;
    notes: string;
  };
  flights: {
    outbound: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string };
    inbound: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string };
    outboundConnecting: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string }[];
    inboundConnecting: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string }[];
  };
  owner: {
    name: string;
    role: "Agent" | "Manager" | "Homeworker";
  };
  commissions: {
    tourOperator: string;
    price: number;
    commissionPercent: number;
    commissionValue: number;
    discounts: number;
    serviceCharge: number;
    totalCommission: number;
    haysDeduction: number;
    netCommission: number;
    referralPayout: number;
    agentSplitPercent: number;
    agentSplitValue: number;
    netToAgency: number;
    walletCredit: number;
  };
  pricePerPerson: number;
  tags: string[];
  notes: string[];
  lodge?: { name: string; type: string; code: string };
  cottage?: { name: string; code: string };
  cruise?: { cruiseLine: string; ship: string; cabinType: string; cruiseName: string; cruiseDate: string; preCruiseStay: number; postCruiseStay: number };
  pets: number;
  haysRef?: string;
  supplierRef?: string;
  transfers: Array<{ pickUpLocation: string | null; dropOffLocation: string | null; pickUpTime: string | null; dropOffTime: string | null; note: string | null; tourOperatorName: string | null }>;
  carHires: Array<{ pickUpLocation: string | null; dropOffLocation: string | null; pickUpTime: string | null; dropOffTime: string | null; noOfDays: number | null; tourOperatorName: string | null }>;
  attractionTickets: Array<{ ticketType: string | null; dateOfVisit: string | null; numberOfTickets: number | null; tourOperatorName: string | null }>;
  loungePasses: Array<{ terminal: string | null; airportName: string | null; dateOfUsage: string | null; note: string | null; tourOperatorName: string | null }>;
  airportParkings: Array<{ parkingType: string | null; airportName: string | null; parkingDate: string | null; duration: string | null; tourOperatorName: string | null }>;
  extraAccommodations: Array<{ property: string; checkInDate: string; noOfNights: number | null; board: string; roomType: string; tourOperatorName: string | null }>;
};

export function transformQuoteData(apiData: EnrichedQuote | EnrichedBooking): QuoteDisplay {
  const flights = apiData.flights || [];
  const cruises = apiData.cruises || [];
  const outboundFlights = flights.filter(f => f.flight_type === "outbound").sort((a, b) => (a.leg_order || 0) - (b.leg_order || 0));
  const inboundFlights = flights.filter(f => f.flight_type === "inbound").sort((a, b) => (a.leg_order || 0) - (b.leg_order || 0));
  const outboundFlight = outboundFlights[0] || flights[0];
  const inboundFlight = inboundFlights.length > 0 ? inboundFlights[0] : (flights.length > 1 ? flights[1] : undefined);

  const obDepart = splitIsoDateTime(outboundFlight?.departure_date_time || "");
  const obArrive = splitIsoDateTime(outboundFlight?.arrival_date_time || "");
  const ibDepart = splitIsoDateTime(inboundFlight?.departure_date_time || "");
  const ibArrive = splitIsoDateTime(inboundFlight?.arrival_date_time || "");

  const mapConnectingFlight = (f: typeof flights[0]) => {
    const dep = splitIsoDateTime(f.departure_date_time || "");
    const arr = splitIsoDateTime(f.arrival_date_time || "");
    return {
      from: f.departing_airport_name || "",
      to: f.arrival_airport_name || "",
      carrier: "",
      flightNo: f.flight_number || "",
      depart: f.departure_date_time || "",
      arrive: f.arrival_date_time || "",
      departDate: dep.date,
      departTime: dep.time,
      arriveDate: arr.date,
      arriveTime: arr.time,
    };
  };
  const outboundConnecting = outboundFlights.slice(1).map(mapConnectingFlight);
  const inboundConnecting = inboundFlights.slice(1).map(mapConnectingFlight);

  const accommodations = apiData.accommodations || [];
  const primaryAccom = accommodations.find(a => a.is_primary) || accommodations[0];

  const travelDate = apiData.travel_date || "";
  const numNights = apiData.num_of_nights || 0;
  const returnDate = travelDate ? (() => {
    const d = new Date(travelDate);
    d.setDate(d.getDate() + numNights);
    return d.toISOString().split("T")[0];
  })() : "";

  const salesPrice = parseFloat(apiData.sales_price || "0");
  const packageCommission = parseFloat(apiData.package_commission || "0");
  const discounts = parseFloat(apiData.discounts || "0");
  const serviceCharge = parseFloat(apiData.service_charge || "0");
  const walletCredit = parseFloat((apiData as any).wallet_credit || "0");

  const childPassengers = (apiData.passengers || []).filter((p: Passenger) => p.type === "child");
  console.log(apiData)
  const result = {
    id: apiData.id,
    transaction_id: apiData.transaction_id,
    isCopyQuote: "isQuoteCopy" in apiData ? Boolean(apiData.isQuoteCopy) : false,
    status: ("quote_status" in apiData ? apiData.quote_status : "booking_status" in apiData ? apiData.booking_status : null) || "draft",
    packageType: apiData.holiday_type_name || ("quote_type" in apiData ? apiData.quote_type : null) || "",
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
    checkInTime: primaryAccom?.check_in_date_time ? splitIsoDateTime(primaryAccom.check_in_date_time).time : "",
    nights: numNights,
    transferType: apiData.transfer_type || "",
    preBookedSeats: apiData.pre_booked_seats || "",
    flightMeals: apiData.flight_meals ? "Yes" : "No",
    leadSource: apiData.lead_source || "",
    tags: apiData.tags || [],
    passengers: {
      adults: apiData.adult || 0,
      children: apiData.child || 0,
      childAges: childPassengers.map((p: Passenger) => p.age || 0),
    },
    accommodation: {
      property: primaryAccom?.accomodation_name || "",
      board: primaryAccom?.board_basis_name || "",
      roomType: primaryAccom?.room_type_name || primaryAccom?.room_type || "",
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
      outboundConnecting,
      inboundConnecting,
    },
    owner: {
      name: "Agent",
      role: "Agent" as const,
    },
    pricePerPerson: parseFloat(String(apiData.price_per_person || "0")) || 0,
    commissions: {
      tourOperator: apiData.main_tour_operator_name || "",
      price: salesPrice,
      commissionPercent: salesPrice > 0 ? (packageCommission / salesPrice) * 100 : 0,
      commissionValue: (packageCommission - serviceCharge) + discounts,
      discounts: discounts,
      serviceCharge: serviceCharge,
      totalCommission: packageCommission,
      haysDeduction: parseFloat((packageCommission * 0.10).toFixed(2)),
      netCommission: parseFloat((packageCommission - (packageCommission - packageCommission * 0.10) * 0.25).toFixed(2)),
      referralPayout: parseFloat(((packageCommission - packageCommission * 0.10) * 0.25).toFixed(2)),
      agentSplitPercent: 0,
      agentSplitValue: 0,
      netToAgency: packageCommission,
      walletCredit,
    },
    notes: [],
    pets: apiData.pets || 0,
    lodge: ("lodge_type" in apiData && apiData.lodge_type) ? { name: ("lodge_name" in apiData ? (apiData as any).lodge_name : "") || "", type: apiData.lodge_type || "", code: ("lodge_code" in apiData ? (apiData as any).lodge_code : "") || "" } : undefined,
    cruise: cruises.length > 0 ? { cruiseLine: cruises[0].cruise_line || "", ship: cruises[0].ship || "", cabinType: cruises[0].cabin_type || "", cruiseName: cruises[0].cruise_name || "", cruiseDate: cruises[0].cruise_date || "", preCruiseStay: cruises[0].pre_cruise_stay || 0, postCruiseStay: cruises[0].post_cruise_stay || 0 } : undefined,
    haysRef: ("hays_ref" in apiData ? apiData.hays_ref : undefined) || undefined,
    supplierRef: ("supplier_ref" in apiData ? apiData.supplier_ref : undefined) || undefined,
    transfers: (apiData.transfers || []).map((t: EnrichedTransfer) => ({
      pickUpLocation: t.pick_up_location,
      dropOffLocation: t.drop_off_location,
      pickUpTime: t.pick_up_time,
      dropOffTime: t.drop_off_time,
      note: t.note,
      tourOperatorName: t.tour_operator_name ?? null,
    })),
    carHires: (apiData.carHires || []).map((c: EnrichedCarHire) => ({
      pickUpLocation: c.pick_up_location,
      dropOffLocation: c.drop_off_location,
      pickUpTime: c.pick_up_time,
      dropOffTime: c.drop_off_time,
      noOfDays: c.no_of_days,
      tourOperatorName: c.tour_operator_name ?? null,
    })),
    attractionTickets: (apiData.attractionTickets || []).map((t: EnrichedAttractionTicket) => ({
      ticketType: t.ticket_type,
      dateOfVisit: t.date_of_visit,
      numberOfTickets: t.number_of_tickets,
      tourOperatorName: t.tour_operator_name ?? null,
    })),
    loungePasses: (apiData.loungePasses || []).map((p: EnrichedLoungePass) => ({
      terminal: p.terminal,
      airportName: p.airport_name ?? null,
      dateOfUsage: p.date_of_usage,
      note: p.note,
      tourOperatorName: p.tour_operator_name ?? null,
    })),
    airportParkings: (apiData.airportParkings || []).map((p: EnrichedAirportParking) => ({
      parkingType: p.parking_type,
      airportName: p.airport_name ?? null,
      parkingDate: p.parking_date,
      duration: p.duration,
      tourOperatorName: p.tour_operator_name ?? null,
    })),
    extraAccommodations: accommodations.filter(a => !a.is_primary).map(a => ({
      property: a.accomodation_name || "",
      checkInDate: a.check_in_date_time?.split("T")[0] || "",
      noOfNights: a.no_of_nights,
      board: a.board_basis_name || "",
      roomType: a.room_type_name || a.room_type || "",
      tourOperatorName: a.tour_operator_name ?? null,
    })),
  };

  return result;
}
