/** Rules and shapes the customer portal's quote screens share with the server. */

/** The reasons a customer can give when they say a quote is not for them (the chips, in order). */
export const PORTAL_DECLINE_REASONS = [
  "Too expensive",
  "Wrong dates",
  "Not the right hotel",
  "Wrong destination",
  "Found something else",
  "Plans have changed",
] as const;

export type PortalDeclineReason = (typeof PORTAL_DECLINE_REASONS)[number];

/** What the customer can do on a quote. "interested" is stored as the existing "accepted" action. */
export const PORTAL_QUOTE_ACTIONS = ["interested", "declined", "reopened"] as const;
export type PortalQuoteAction = (typeof PORTAL_QUOTE_ACTIONS)[number];

/** Longest note the customer can attach to an action. */
export const PORTAL_QUOTE_NOTE_MAX = 1000;

export type PortalQuoteDecisionState = "none" | "interested" | "declined";

/** The customer's latest decision on one quote. */
export interface PortalQuoteDecision {
  state: PortalQuoteDecisionState;
  /** Only for "declined", and only when a reason was chosen. */
  reason: string | null;
  note: string | null;
  /** Only for "declined". */
  wantsSimilar: boolean | null;
  /** ISO time of the action; null when there is none. */
  at: string | null;
}

export const NO_DECISION: PortalQuoteDecision = { state: "none", reason: null, note: null, wantsSimilar: null, at: null };

/* ── What the portal API returns for quotes (shared so the client and the server cannot drift) ── */

/** One of the signed-in customer's quotes, as the portal list shows it. Keys keep the portal's snake_case contract. */
export interface PortalQuoteListItem {
  id: string;
  token: string;
  title: string;
  /** "Resort area, Country" (or whichever half exists, or "TBC"). */
  destination: string;
  hotel: string;
  operator_name: string | null;
  /** Customer total, extras included. */
  price: number;
  price_per_person: number;
  travel_date: string;
  /** The last day; null when the quote records no length (never invented). */
  return_date: string | null;
  nights: number | null;
  board: string | null;
  adults: number;
  children: number;
  infants: number;
  /** The quote's real expiry (date_expiry) or null; never invented. */
  expiry_date: string | null;
  sent_at: string | null;
  image_url: string;
  photo_count: number;
  quote_url: string;
  decision: PortalQuoteDecision;
}

export interface PortalQuoteDetailFlight {
  flightType: string | null;
  flightNumber: string | null;
  departingAirport: string;
  arrivalAirport: string;
  departureDateTime: string | null;
  arrivalDateTime: string | null;
  legOrder: number | null;
}

export interface PortalQuoteDetailAccommodation {
  name: string;
  boardBasis: string;
  roomType: string;
  checkInDateTime: string | null;
  resortName: string;
}

export interface PortalQuoteDetailTransfer {
  from: string;
  to: string;
  pickUpTime: string | null;
  dropOffTime: string | null;
  note: string;
}

export interface PortalQuoteDetailCarHire {
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: string | null;
  dropoffTime: string | null;
  numDays: number;
}

export interface PortalQuoteDetailTicket {
  type: string;
  dateOfVisit: string | null;
  numberOfTickets: number;
}

export interface PortalQuoteDetailLounge {
  airportName: string;
  terminal: string;
  dateOfUsage: string | null;
  note: string;
}

export interface PortalQuoteDetailParking {
  airportName: string;
  parkingType: string;
  parkingDate: string | null;
}

export interface PortalQuoteDetailCruise {
  cruiseLine: string;
  ship: string;
  cabinType: string;
  cruiseName: string;
  cruiseDate: string | null;
  itinerary: Array<{ day: number; description: string; subDescription: string }>;
}

/** The full quote for the portal. Only customer-facing fields: no cost, supplier, commission or profit data. */
export interface PortalQuoteDetail {
  id: string;
  token: string;
  title: string;
  holidayType: string;
  travelDate: string | null;
  returnDate: string | null;
  numNights: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  /** Customer total, extras included. */
  total: number;
  pricePerPerson: number;
  operatorName: string | null;
  /** The quote's real expiry (date_expiry) or null; never invented. */
  expiryDate: string | null;
  sentAt: string | null;
  destinationName: string;
  countryName: string;
  resortName: string;
  transferType: string;
  flightMeals: boolean;
  preBookedSeats: string;
  tags: string[];
  flights: PortalQuoteDetailFlight[];
  accommodations: PortalQuoteDetailAccommodation[];
  transfers: PortalQuoteDetailTransfer[];
  carHires: PortalQuoteDetailCarHire[];
  attractionTickets: PortalQuoteDetailTicket[];
  loungePasses: PortalQuoteDetailLounge[];
  airportParkings: PortalQuoteDetailParking[];
  cruises: PortalQuoteDetailCruise[];
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
  destinationGuide: { destination: string; country: string | null; data: unknown } | null;
  agent: { name: string; avatar: string | null };
  /** True when the signed-in customer owns the quote (a published deal can be read but not decided on). */
  canDecide: boolean;
  /** Share is offered only for the customer's own quote, or a published deal with no real customer on it (the public page behind the link names the quote's client). */
  canShare: boolean;
  decision: PortalQuoteDecision;
}

export interface PortalQuoteOwnership {
  found: boolean;
  owns: boolean;
  isPublicDeal: boolean;
}
