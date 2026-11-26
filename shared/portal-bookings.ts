/** What the customer portal's booking endpoints return (shared so the client and the server cannot drift). */
import type {
  PortalQuoteDetailAccommodation,
  PortalQuoteDetailCarHire,
  PortalQuoteDetailCruise,
  PortalQuoteDetailFlight,
  PortalQuoteDetailLounge,
  PortalQuoteDetailParking,
  PortalQuoteDetailTicket,
  PortalQuoteDetailTransfer,
} from "./portal-quotes";

/** Where a trip is, by UK calendar day: before its first day, between its first and last day, or after. */
export type PortalTripStatus = "upcoming" | "in_progress" | "past";

/**
 * One of the signed-in customer's bookings in the list. Keys keep the portal's snake_case contract.
 * The first block of keys is the original contract and must not change; the rest is additive.
 */
export interface PortalBookingListItem {
  id: string;
  title: string;
  destination: string;
  hotel: string;
  /** Customer total, extras included. */
  price: number;
  price_per_person: number;
  travel_date: string | Date;
  /** The last day, or null when the booking has no length recorded (nothing is invented). */
  return_date: string | null;
  /** Nights, or null when none are recorded. */
  nights: number | null;
  /** The agency's reference (else the operator's, as the page has always shown). */
  booking_reference: string;
  image_url: string;
  /** Always "#": kept only so a cached older app does not break. The new portal shows no documents link. */
  documents_url: string;

  /** The operator's own reference; null when blank. */
  supplier_reference: string | null;
  operator_name: string | null;
  board: string | null;
  adults: number;
  children: number;
  infants: number;
  trip_status: PortalTripStatus;
  /** Whole UK calendar days from today to the first day (negative once it has started). */
  days_to_go: number;
}

/** An extra bought for the booking (the type and description only; never a price). */
export interface PortalBookingExtra {
  type: string;
  description: string;
  quantity: number;
}

/**
 * The full booking for the portal. Only customer-facing fields: no cost, commission, supplier cost, internal
 * notes, staff ids or passenger names. Itinerary items have the same shapes as the quote detail's.
 */
export interface PortalBookingDetail {
  id: string;
  title: string;
  destinationName: string;
  countryName: string;
  resortName: string;
  travelDate: string | null;
  /** The last day; null when no length is recorded. */
  returnDate: string | null;
  /** Nights; null when unknown (never invented). */
  numNights: number | null;
  board: string | null;
  adults: number;
  children: number;
  infants: number;
  operatorName: string | null;
  /** The agency's own reference. */
  bookingReference: string;
  /** The tour operator's reference; empty when none. */
  supplierReference: string;
  /** Customer total, extras included (the same figure as the list). */
  total: number;
  pricePerPerson: number;
  tripStatus: PortalTripStatus;
  daysToGo: number;
  flights: PortalQuoteDetailFlight[];
  accommodations: PortalQuoteDetailAccommodation[];
  transfers: PortalQuoteDetailTransfer[];
  carHires: PortalQuoteDetailCarHire[];
  attractionTickets: PortalQuoteDetailTicket[];
  loungePasses: PortalQuoteDetailLounge[];
  airportParkings: PortalQuoteDetailParking[];
  cruises: PortalQuoteDetailCruise[];
  extras: PortalBookingExtra[];
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
  /** Name and avatar only. */
  agent: { name: string; avatar: string | null };
}
