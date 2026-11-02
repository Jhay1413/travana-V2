export type {
  Booking,
  InsertBooking,
  BookingFlight,
  InsertBookingFlight,
  BookingAccomodation,
  InsertBookingAccomodation,
  BookingTransfer,
  InsertBookingTransfer,
  BookingCarHire,
  InsertBookingCarHire,
  BookingAttractionTicket,
  InsertBookingAttractionTicket,
  BookingLoungePass,
  InsertBookingLoungePass,
  BookingAirportParking,
  InsertBookingAirportParking,
} from '@shared/schema';

/** Child rows of a booking that are removed one at a time by their own id. */
export type BookingChildKind = "flight" | "accommodation";
