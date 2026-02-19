export interface ScraperFlight {
  flight_number?: string | null;
  flight_ref?: string | null;
  departing_airport?: string;
  flight_type?: string;
  departure_date_time?: string;
  arrival_airport?: string;
  arrival_date_time?: string;
}

export interface ScraperHotel {
  country?: string;
  destination?: string;
  resort?: string;
  accommodation?: string;
  no_of_nights?: string | number;
  check_in_date_time?: string;
  arrival_date_time?: string;
  room_type?: string;
  board_basis?: string;
  stay_type?: string;
  tour_operator?: string;
  cost?: string | number;
  hotel_description?: string | null;
  hotel_images?: string[];
  room_description?: string;
  room_images?: string[];
}

export interface ScraperJson {
  travel_date?: string;
  tour_operator?: string;
  sales_price?: string | number;
  adults?: string | number;
  children?: string | number;
  infants?: string | number;
  no_of_nights?: string | number;
  transfer_type?: string | null;
  check_in_date_time?: string;
  arrival_date_time?: string;
  departure_airport?: string;
  arrival_airport?: string;
  country?: string;
  destination?: string;
  resort?: string;
  accommodation?: string;
  board_basis?: string;
  room_type?: string;
  room_description?: string;
  hotel_description?: string | null;
  hotel_images?: string[];
  room_images?: string[];
  flights?: ScraperFlight[];
  hotels?: ScraperHotel[];
  transfers?: unknown[];
  attraction_tickets?: unknown[];
  car_hire?: unknown[];
  airport_parking?: unknown[];
  lounge_pass?: unknown[];
  [key: string]: unknown;
}

export interface ParsedConnectingLeg {
  departAirportId: string;
  departAirport: string;
  arriveAirportId: string;
  arriveAirport: string;
  departDate: string;
  departTime: string;
  arriveDate: string;
  arriveTime: string;
  flightNumber: string;
}

function parseDateTimePart(dt: string | undefined | null): { date: string; time: string } {
  if (!dt) return { date: "", time: "" };
  const tIdx = dt.indexOf("T");
  if (tIdx === -1) {
    return { date: convertToIsoDate(dt), time: "" };
  }
  const datePart = dt.substring(0, tIdx);
  const timePart = dt.substring(tIdx + 1);
  return {
    date: convertToIsoDate(datePart),
    time: timePart.length >= 5 ? timePart.substring(0, 5) : timePart,
  };
}

function convertToIsoDate(d: string): string {
  if (!d) return "";
  const match = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  return d;
}

function toNum(v: string | number | undefined | null, fallback: number): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = typeof v === "number" ? v : parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

function toAmount(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === "") return "";
  if (typeof v === "number") return v.toString();
  return v;
}

function normalizeFlightType(ft: string | undefined): string {
  if (!ft) return "";
  return ft.toLowerCase().trim();
}

function isOutboundFlightType(ft: string | undefined): boolean {
  const normalized = normalizeFlightType(ft);
  return normalized === "outbound" || normalized === "departure" || normalized === "out";
}

function isInboundFlightType(ft: string | undefined): boolean {
  const normalized = normalizeFlightType(ft);
  return normalized === "return" || normalized === "inbound" || normalized === "in";
}

function mapToConnectingLeg(flight: ScraperFlight): ParsedConnectingLeg {
  const dep = parseDateTimePart(flight.departure_date_time);
  const arr = parseDateTimePart(flight.arrival_date_time);

  return {
    departAirportId: "",
    departAirport: flight.departing_airport || "",
    arriveAirportId: "",
    arriveAirport: flight.arrival_airport || "",
    departDate: dep.date,
    departTime: dep.time,
    arriveDate: arr.date,
    arriveTime: arr.time,
    flightNumber: flight.flight_number || "",
  };
}

export function mapScraperJsonToFormFields(data: ScraperJson) {
  const flights = Array.isArray(data.flights) ? data.flights : [];
  const outboundFlights = flights.filter((f) => isOutboundFlightType(f.flight_type));
  const inboundFlights = flights.filter((f) => isInboundFlightType(f.flight_type));

  const outbound = outboundFlights[0];
  const inbound = inboundFlights[0];
  const outboundConnectingLegs = outboundFlights.slice(1).map(mapToConnectingLeg);
  const inboundConnectingLegs = inboundFlights.slice(1).map(mapToConnectingLeg);

  const hotel = Array.isArray(data.hotels) && data.hotels.length > 0 ? data.hotels[0] : undefined;

  const hotelCheckIn = parseDateTimePart(hotel?.check_in_date_time || data.check_in_date_time);

  const outDep = parseDateTimePart(outbound?.departure_date_time);
  const outArr = parseDateTimePart(outbound?.arrival_date_time);
  const inDep = parseDateTimePart(inbound?.departure_date_time);
  const inArr = parseDateTimePart(inbound?.arrival_date_time);

  const checkInDate = hotelCheckIn.date || outDep.date;
  const checkInTime = hotelCheckIn.time || outDep.time;

  if (!outDep.date && data.check_in_date_time) {
    const fallback = parseDateTimePart(data.check_in_date_time);
    outDep.date = outDep.date || fallback.date;
    outDep.time = outDep.time || fallback.time;
  }
  if (!outArr.date && data.arrival_date_time) {
    const fallback = parseDateTimePart(data.arrival_date_time);
    outArr.date = outArr.date || fallback.date;
    outArr.time = outArr.time || fallback.time;
  }

  const allImages: string[] = [];
  for (const src of [data.hotel_images, hotel?.hotel_images, data.room_images, hotel?.room_images]) {
    if (Array.isArray(src)) {
      for (const img of src) {
        if (typeof img === "string" && img.startsWith("http") && !allImages.includes(img)) {
          allImages.push(img);
        }
      }
    }
  }

  const salesAmount = toAmount(data.sales_price || hotel?.cost);

  return {
    fields: {
      travelDate: convertToIsoDate(data.travel_date || ""),
      tourOperator: data.tour_operator || hotel?.tour_operator || "",
      sales: salesAmount,
      price: salesAmount,
      passengersAdults: toNum(data.adults, 2),
      passengersChildren: toNum(data.children, 0),
      passengersInfants: toNum(data.infants, 0),
      nights: toNum(data.no_of_nights || hotel?.no_of_nights, 7),
      transferType: data.transfer_type || "",
      country: data.country || hotel?.country || "",
      destination: data.destination || hotel?.destination || "",
      resort: data.resort || hotel?.resort || "",
      accommodation: data.accommodation || hotel?.accommodation || "",
      boardBasis: data.board_basis || hotel?.board_basis || "",
      roomType: data.room_type || hotel?.room_type || "",
      checkInDate: checkInDate,
      checkInTime: checkInTime,
      outboundDepartAirport: outbound?.departing_airport || data.departure_airport || "",
      outboundDepartDate: outDep.date,
      outboundDepartTime: outDep.time,
      outboundArriveAirport: outbound?.arrival_airport || data.arrival_airport || "",
      outboundArriveDate: outArr.date,
      outboundArriveTime: outArr.time,
      outboundFlightNumber: outbound?.flight_number || "",
      inboundDepartAirport: inbound?.departing_airport || "",
      inboundDepartDate: inDep.date,
      inboundDepartTime: inDep.time,
      inboundArriveAirport: inbound?.arrival_airport || "",
      inboundArriveDate: inArr.date,
      inboundArriveTime: inArr.time,
      inboundFlightNumber: inbound?.flight_number || "",
    },
    outboundConnectingLegs,
    inboundConnectingLegs,
    images: allImages,
  };
}
