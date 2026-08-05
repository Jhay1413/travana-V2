// Parameters extracted from a trade-portal deep link, in the shape the
// offers API expects. Occupancy can't always be derived from the link alone,
// so it is overridable from the request body.
export interface EasyJetLinkParams {
  startDate: string; // YYYY-MM-DD
  duration: number; // nights
  flexibleDays: number;
  departure: string; // e.g. "NCL,MAN"
  adults: number;
  children: number;
  infants: number;
  roomCode: string; // e.g. "DB02"
  accommodationId: string; // e.g. "GRRH0112"
  outboundRouteId: string;
  inboundRouteId: string;
  packageId: string; // e.g. "2294430801/2/3147/7"
  boardType: string; // e.g. "AI"
  transfer: string; // e.g. "GEMT55066KSS"
  geography: string; // e.g. "ES|GR|TR"
  isExt: boolean;
  lateRoomCheckout: boolean;
}

export interface ScrapeRequestBody {
  url: string;
  adults?: number;
  children?: number;
  infants?: number;
}

// ─── Output contract ─────────────────────────────────────────────────────────
// This mirrors the client's existing `ScraperJson` shape
// (client/src/lib/scraper-json-parser.ts), so a scrape result flows through the
// same import pipeline as an uploaded scraper JSON file. Keep the snake_case
// keys in sync with that file.

export interface ScrapedFlightJson {
  flight_number: string;
  flight_type: 'outbound' | 'return';
  departing_airport: string; // IATA code
  departing_airport_name: string;
  departure_date_time: string; // "YYYY-MM-DDTHH:mm"
  arrival_airport: string;
  arrival_airport_name: string;
  arrival_date_time: string;
}

export interface ScrapedTransferJson {
  tour_operator: string;
  note: string;
  cost: number;
  is_included_in_package: boolean;
}

export interface ScrapedQuoteJson {
  source_url: string;
  scraped_at: string; // ISO timestamp
  tour_operator: string;
  travel_date: string; // YYYY-MM-DD
  no_of_nights: number;
  adults: number;
  children: number;
  infants: number;
  sales_price: number;
  price_per_person: number;
  currency: string;
  discount: number;
  tourist_tax_total: number;
  promotion_code: string;
  promotion_discount: number;
  country: string;
  destination: string;
  resort: string;
  accommodation: string;
  board_basis: string;
  room_type: string;
  check_in_date_time: string;
  transfer_type: string;
  hotel_description: string;
  hotel_images: string[];
  room_images: string[];
  flights: ScrapedFlightJson[];
  transfers: ScrapedTransferJson[];
  included_luggage: string[];
  star_rating: string;
  review_score: number | null;

  // ─── Cruise Package (present only when the page is a cruise) ───────────────
  // The client detects a cruise when cruise_line + ship_name are set and routes
  // into the cruise quote section (see json-import-handler handleCruiseJson).
  cruise_line?: string;
  ship_name?: string;
  cruise_date?: string; // YYYY-MM-DD
  cruise_title?: string;
  embarkation?: string;
  debarkation?: string;
  cabin_type?: string;
  cabin_number?: string;
  cruise_only?: boolean;
  cruise_extras?: string;
  itinerary?: { day: number; description: string; sub_description?: string }[];

  // ─── Hot Tub Break / lodge (present only when the page is a lodge) ─────────
  // The client detects a lodge from these fields and sets the Hot Tub Break
  // package type (accommodation = lodge name, resort = park name).
  lodge_type?: string;
  lodge_code?: string;
  lodge_park_name?: string;
  cottage_id?: string;
  hot_tub?: boolean;
  pets?: number;
}
