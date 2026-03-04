export interface Transaction {
  id: string;
  status: string | null;
  is_active: boolean | null;
  client_id: string | null;
  agent_id: string | null;
  lead_source: string | null;
  user_id: string;
  created_at: string;
  enquiry?: EnquiryTable | null;
  quotes?: Quote[];
  booking?: Booking | null;
  client?: { id: string; name?: string } | null;
  agent?: { id: string; name?: string } | null;
}

export interface EnquiryDestination {
  id: string;
  enquiry_id: string;
  destination_id: string;
  name?: string;
}

export interface EnquiryResort {
  id: string;
  enquiry_id: string;
  resort_id: string;
  name?: string;
}

export interface EnquiryAccommodation {
  id: string;
  enquiry_id: string;
  accomodation_id: string;
  name?: string;
}

export interface EnquiryBoardBasis {
  id: string;
  enquiry_id: string;
  board_basis_id: string;
  name?: string;
}

export interface EnquiryAirport {
  id: string;
  enquiry_id: string;
  airport_id: string;
  name?: string;
}

export interface EnquiryPassenger {
  id: string;
  enquiry_id: string;
  type: string;
  age: number;
}

export interface EnquiryTable {
  id: string;
  transaction_id: string;
  holiday_type_id: string;
  accomodation_type_id: string | null;
  travel_date: string | null;
  adults: number | null;
  children: number | null;
  infants: number | null;
  cabin_type: string | null;
  title: string | null;
  flexibility_date: string | null;
  flexible_date: string | null;
  weekend_lodge: string | null;
  accom_min_star_rating: string | null;
  no_of_nights: number | null;
  budget: string | null;
  max_budget: string | null;
  budget_type: string | null;
  no_of_guests: number | null;
  no_of_pets: number | null;
  pre_cruise_stay: number | null;
  post_cruise_stay: number | null;
  status: string | null;
  date_created: string | null;
  date_expiry: string | null;
  is_future_deal: boolean | null;
  future_deal_date: string | null;
  is_expired: boolean | null;
  is_active: boolean | null;
  deletion_code: string | null;
  email: string | null;
  user_id?: string;
  holiday_type_name?: string;
  destinations?: EnquiryDestination[];
  resorts?: EnquiryResort[];
  accommodations?: EnquiryAccommodation[];
  boardBases?: EnquiryBoardBasis[];
  airports?: EnquiryAirport[];
  passengers?: EnquiryPassenger[];
}

export interface Quote {
  id: string;
  transaction_id: string;
  deal_id: string | null;
  holiday_type_id: string;
  sales_price: string | null;
  package_commission: string | null;
  travel_date: string;
  discounts: string | null;
  service_charge: string | null;
  num_of_nights: number;
  pets: number;
  cottage_id: string | null;
  lodge_id: string | null;
  park_id: string | null;
  quote_type: string;
  deal_type: string | null;
  pre_booked_seats: string | null;
  flight_meals: boolean | null;
  infant: number | null;
  child: number | null;
  adult: number | null;
  title: string | null;
  price_per_person: string;
  lodge_type: string | null;
  transfer_type: string;
  quote_status: string | null;
  main_tour_operator_id: string | null;
  date_created: string | null;
  date_expiry: string | null;
  is_future_deal: boolean | null;
  future_deal_date: string | null;
  is_active: boolean | null;
  quote_ref: string | null;
  isQuoteCopy: boolean | null;
  isFreeQuote: boolean | null;
  flights?: QuoteFlight[];
  accommodations?: QuoteAccommodation[];
  transfers?: QuoteTransfer[];
  carHires?: QuoteCarHire[];
  attractionTickets?: QuoteAttractionTicket[];
  loungePasses?: QuoteLoungePass[];
  airportParkings?: QuoteAirportParking[];
  cruises?: QuoteCruise[];
  passengers?: Passenger[];
  images?: DealImage[];
  tags?: string[];
}

export interface QuoteFlight {
  id: string;
  quote_id: string | null;
  flight_number: string | null;
  flight_ref: string | null;
  departing_airport_id: string | null;
  arrival_airport_id: string | null;
  tour_operator_id: string | null;
  flight_type: string | null;
  departure_date_time: string | null;
  arrival_date_time: string | null;
  is_included_in_package: boolean | null;
  cost: string | null;
  commission: string | null;
  leg_order: number | null;
}

export interface QuoteAccommodation {
  id: string;
  booking_ref: string | null;
  tour_operator_id: string | null;
  no_of_nights: number;
  room_type: string | null;
  board_basis_id: string | null;
  check_in_date_time: string | null;
  stay_type: string | null;
  is_primary: boolean | null;
  is_included_in_package: boolean | null;
  cost: string | null;
  commission: string | null;
  accomodation_id: string | null;
  quote_id: string | null;
}

export interface QuoteTransfer {
  id: string;
  booking_ref: string | null;
  tour_operator_id: string | null;
  pick_up_location: string | null;
  drop_off_location: string | null;
  pick_up_time: string | null;
  drop_off_time: string | null;
  is_included_in_package: boolean | null;
  cost: string | null;
  commission: string | null;
  quote_id: string | null;
  note: string | null;
}

export interface QuoteCarHire {
  id: string;
  quote_id: string | null;
  booking_ref: string | null;
  tour_operator_id: string | null;
  pick_up_location: string | null;
  drop_off_location: string | null;
  pick_up_time: string | null;
  drop_off_time: string | null;
  no_of_days: number;
  driver_age: number;
  is_included_in_package: boolean | null;
  cost: string | null;
  commission: string | null;
}

export interface QuoteAttractionTicket {
  id: string;
  quote_id: string | null;
  booking_ref: string | null;
  tour_operator_id: string | null;
  ticket_type: string | null;
  date_of_visit: string | null;
  cost: string | null;
  commission: string | null;
  number_of_tickets: number;
  is_included_in_package: boolean | null;
}

export interface QuoteLoungePass {
  id: string;
  quote_id: string | null;
  booking_ref: string | null;
  terminal: string | null;
  airport_id: string | null;
  date_of_usage: string | null;
  tour_operator_id: string | null;
  cost: string | null;
  commission: string | null;
  is_included_in_package: boolean | null;
  note: string | null;
}

export interface QuoteAirportParking {
  id: string;
  booking_ref: string | null;
  quote_id: string | null;
  airport_id: string | null;
  parking_type: string | null;
  parking_date: string | null;
  car_make: string | null;
  car_model: string | null;
  colour: string | null;
  car_reg_number: string | null;
  duration: string | null;
  tour_operator_id: string | null;
  is_included_in_package: boolean | null;
  cost: string | null;
  commission: string | null;
}

export interface QuoteCruise {
  id: string;
  tour_operator_id: string | null;
  cruise_line: string | null;
  ship: string | null;
  cruise_date: string | null;
  cabin_type: string | null;
  cruise_name: string | null;
  pre_cruise_stay: number;
  post_cruise_stay: number;
  quote_id: string | null;
}

export interface Passenger {
  id: string;
  type: string | null;
  age: number;
  quote_id: string | null;
  lounge_pass_id: string | null;
  booking_id: string | null;
}

export interface DealImage {
  id: string;
  image_url: string | null;
  s3Key: string | null;
  owner_type: string | null;
  owner_id: string;
  isPrimary: boolean | null;
}

export interface Booking {
  id: string;
  transaction_id: string;
  deal_type: string | null;
  pre_booked_seats: string | null;
  flight_meals: boolean | null;
  holiday_type_id: string;
  hays_ref: string;
  supplier_ref: string;
  is_active: boolean | null;
  sales_price: string | null;
  package_commission: string | null;
  travel_date: string;
  title: string | null;
  discounts: string | null;
  service_charge: string | null;
  num_of_nights: number;
  pets: number;
  cottage_id: string | null;
  lodge_id: string | null;
  lodge_type: string | null;
  transfer_type: string | null;
  infant: number;
  child: number;
  adult: number;
  booking_status: string | null;
  main_tour_operator_id: string | null;
  date_created: string | null;
}

// Extended types with joined data from repository
export interface EnrichedQuoteFlight extends QuoteFlight {
  departing_airport_name?: string;
  arrival_airport_name?: string;
  tour_operator_name?: string;
}

export interface EnrichedQuoteAccommodation extends QuoteAccommodation {
  accomodation_name?: string;
  board_basis_name?: string;
  tour_operator_name?: string;
  room_type_name?: string;
}

export interface EnrichedQuoteCruise extends QuoteCruise {
  tour_operator_name?: string;
}

export interface EnrichedQuote extends Quote {
  holiday_type_name?: string;
  main_tour_operator_name?: string;
  lead_source?: string;
  user_id?: string;
  country_id?: string | null;
  country_name?: string | null;
  destination_id?: string | null;
  destination_name?: string | null;
  resort_id?: string | null;
  resort_name?: string | null;
  departing_airport_name?: string | null;
  client_id?: string | null;
  flights?: EnrichedQuoteFlight[];
  accommodations?: EnrichedQuoteAccommodation[];
  cruises?: EnrichedQuoteCruise[];
  tags?: string[];
}

export interface EnrichedBooking extends Booking {
  holiday_type_name?: string;
  main_tour_operator_name?: string;
  lead_source?: string;
  user_id?: string;
  country_id?: string | null;
  country_name?: string | null;
  destination_id?: string | null;
  destination_name?: string | null;
  resort_id?: string | null;
  resort_name?: string | null;
  departing_airport_name?: string | null;
  client_id?: string | null;
  tags?: string[];
  flights?: EnrichedQuoteFlight[];
  accommodations?: EnrichedQuoteAccommodation[];
  cruises?: EnrichedQuoteCruise[];
  passengers?: Passenger[];
  images?: DealImage[];
}

export interface TransactionNote {
  id: string;
  description: string | null;
  content: string | null;
  agent_id: string | null;
  user_id: string | null;
  createdAt: string;
  parent_id: string | null;
  transaction_id: string | null;
}

export interface EnquiryRelations {
  destinations?: string[];
  resorts?: string[];
  accommodations?: string[];
  boardBases?: string[];
  departureAirports?: string[];
}

export interface FlightRelationData {
  departing_airport_id?: string;
  arrival_airport_id?: string;
  departure_date_time?: string;
  arrival_date_time?: string;
  is_included_in_package?: boolean;
  flight_number?: string;
  flight_ref?: string;
  tour_operator_id?: string;
  cost?: string;
  commission?: string;
}

export interface AccommodationRelationData {
  accomodation_id?: string;
  board_basis_id?: string;
  no_of_nights?: number;
  check_in_date_time?: string;
  is_included_in_package?: boolean;
  is_primary?: boolean;
  room_type?: string;
  stay_type?: string;
  booking_ref?: string;
  tour_operator_id?: string;
  cost?: string;
  commission?: string;
}

export interface WithRelations {
  outboundFlight?: FlightRelationData;
  inboundFlight?: FlightRelationData;
  outboundConnectingLegs?: FlightRelationData[];
  inboundConnectingLegs?: FlightRelationData[];
  primaryAccommodation?: AccommodationRelationData;
  images?: string[];
}

export interface CreateTransactionData {
  client_id?: string;
  agent_id?: string;
  lead_source?: string;
  user_id: string;
  enquiry?: Partial<EnquiryTable> & EnquiryRelations;
  quote?: Partial<CreateQuoteData> & WithRelations;
  booking?: Partial<Booking> & WithRelations;
}

export interface CreateQuoteData {
  transaction_id: string;
  holiday_type_id: string;
  travel_date: string;
  quote_type: string;
  num_of_nights?: number;
  adult?: number;
  child?: number;
  infant?: number;
  sales_price?: string;
  package_commission?: string;
  title?: string;
  price_per_person?: string;
  transfer_type?: string;
  pre_booked_seats?: string;
  flight_meals?: boolean;
  main_tour_operator_id?: string;
  quote_status?: string;
  lodge_id?: string;
  lodge_type?: string;
  cottage_id?: string;
  pets?: number;
  discounts?: string;
  service_charge?: string;
  lead_source?: string;
  quote_link?: string;
  country?: string;
  destination?: string;
  resort?: string;
  cruiseTitle?: string;
  cruiseLine?: string;
  shipName?: string;
  cruiseDate?: string;
  cabinType?: string;
  embarkation?: string;
  debarkation?: string;
  cruiseExtras?: string;
  cruiseOnly?: boolean;
  parkName?: string;
  outboundFlight?: Record<string, unknown>;
  inboundFlight?: Record<string, unknown>;
  outboundConnectingLegs?: Record<string, unknown>[];
  inboundConnectingLegs?: Record<string, unknown>[];
  primaryAccommodation?: Record<string, unknown>;
  images?: string[];
}

export interface QuoteFilters {
  status?: string;
  transactionId?: string;
}
