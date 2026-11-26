import { AppError } from "../../utils/error-handler";

/** The share buttons the public page offers, plus the two the portal's share sheet adds. Nothing else is accepted. */
export const PUBLIC_SHARE_METHODS = ["WhatsApp", "Facebook", "Email", "Copy Link", "Text message", "Share"] as const;
export type PublicShareMethod = (typeof PUBLIC_SHARE_METHODS)[number];

/** Dates reach the page exactly as stored: the page reads the date parts itself, so nothing is re-parsed here. */
export type DateValue = string | Date | null;

export type QuoteBlockCode = "BOOKED" | "UNAVAILABLE";

export interface AgencyContact {
  name: string | null;
  phone: string | null;
}

/** The facts the repository reads to decide whether the public link may open a quote. */
export interface QuoteAccessRow {
  /** The portal's customerVisibleQuoteWhere holds for this quote. */
  visible: boolean;
  /** The quote's deal has a live booking. */
  isBooked: boolean;
  /** The deal's client is soft-deleted (false when the deal has no client). */
  clientDeleted: boolean;
  dateExpiry: Date | string | null;
  agencyName: string | null;
  agencySettings: unknown;
}

export interface QuoteBlock {
  code: QuoteBlockCode;
  agency: AgencyContact;
}

/** What a blocked link answers with: nothing about the quote, never why it is blocked. */
export interface QuoteBlockBody {
  error: string;
  code: QuoteBlockCode;
  agency: AgencyContact;
}

export const BLOCK_MESSAGES: Record<QuoteBlockCode, string> = {
  BOOKED: "This holiday has been booked.",
  UNAVAILABLE: "This quote is no longer available.",
};

/** Thrown by the service for a quote the public link must not open; the controller answers 410 with `body`. */
export class QuoteBlockedError extends AppError {
  readonly body: QuoteBlockBody;

  constructor(block: QuoteBlock) {
    super(BLOCK_MESSAGES[block.code], 410, true, block.code);
    Object.setPrototypeOf(this, QuoteBlockedError.prototype);
    this.body = { error: BLOCK_MESSAGES[block.code], code: block.code, agency: block.agency };
  }
}

/** Exactly what the public page renders: no client or passenger names, ids or price breakdown. */
export interface PublicQuotePayload {
  title: string;
  holidayType: string;
  travelDate: string | null;
  numNights: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  totalPrice: string;
  pricePerPerson: string;
  transferType: string;
  flightMeals: boolean;
  preBookedSeats: string;
  destinationName: string;
  countryName: string;
  resortName: string;
  flights: Array<{
    flightType: string | null;
    flightNumber: string | null;
    departingAirport: string;
    arrivalAirport: string;
    departureDateTime: DateValue;
    arrivalDateTime: DateValue;
    legOrder: number | null;
  }>;
  accommodations: Array<{
    name: string;
    boardBasis: string;
    roomType: string;
    checkInDateTime: DateValue;
    starRating: string | null;
  }>;
  transfers: Array<{ from: string; to: string; note: string }>;
  carHires: Array<{ pickupLocation: string; dropoffLocation: string; numDays: number }>;
  attractionTickets: Array<{ type: string; dateOfVisit: DateValue; numberOfTickets: number }>;
  loungePasses: Array<{ airportName: string; terminal: string; dateOfUsage: DateValue }>;
  airportParkings: Array<{ airportName: string; parkingType: string; parkingDate: DateValue }>;
  cruises: Array<{
    cruiseLine: string;
    ship: string;
    cabinType: string;
    cruiseName: string;
    cruiseDate: DateValue;
    itinerary: Array<{ day: number; description: string; subDescription: string }>;
  }>;
  images: Array<{ image_url: string | null; isPrimary: boolean | null }>;
  destinationGuru: { destination: string; country: string | null; data: unknown } | null;
  agent: { name: string; avatar: string | null };
  agency: AgencyContact;
  /** True when date_expiry has passed: the page opens with a "price was held until" banner. */
  expired: boolean;
  expiredOn: string | null;
}

/** The staff preview answers the same payload plus why the public link would refuse it (null when it would open). */
export interface PreviewQuotePayload extends PublicQuotePayload {
  previewBlock: QuoteBlockCode | null;
}
