/** Rows the booking detail is built from (repository output). Only the columns the portal may show are selected. */

type Time = Date | string | null;

export interface BookingHeaderRow {
  bookingId: string;
  quoteId: string | null;
  title: string | null;
  haysRef: string | null;
  supplierRef: string | null;
  salesPrice: string | null;
  discounts: string | null;
  serviceCharge: string | null;
  /** Cost of extras not included in the package (added to the customer total, as in the list). */
  extrasTotal: string | number | null;
  adult: number | null;
  child: number | null;
  infant: number | null;
  travelDate: string | Date;
  numNights: number | null;
  operatorName: string | null;
  boardName: string | null;
  destinationName: string | null;
  countryName: string | null;
  resortName: string | null;
  agentFirstName: string | null;
  agentLastName: string | null;
  agentAvatar: string | null;
}

export interface BookingFlightRow {
  flightType: string | null;
  flightNumber: string | null;
  departingAirport: string | null;
  arrivalAirport: string | null;
  departureDateTime: Time;
  arrivalDateTime: Time;
}

export interface BookingAccommodationRow {
  name: string | null;
  boardBasis: string | null;
  roomType: string | null;
  checkInDateTime: Time;
  resortName: string | null;
  isPrimary: boolean | null;
}

export interface BookingTransferRow {
  pickUp: string | null;
  dropOff: string | null;
  pickUpTime: Time;
  dropOffTime: Time;
}

export interface BookingCarHireRow {
  pickUp: string | null;
  dropOff: string | null;
  pickUpTime: Time;
  dropOffTime: Time;
  numDays: number | null;
}

export interface BookingAttractionRow {
  ticketType: string | null;
  dateOfVisit: Time;
  numberOfTickets: number | null;
}

export interface BookingLoungeRow {
  airportName: string | null;
  terminal: string | null;
  dateOfUsage: Time;
}

export interface BookingAirportParkingRow {
  airportName: string | null;
  parkingType: string | null;
  parkingDate: Time;
}

export interface BookingCruiseRow {
  cruiseLine: string | null;
  ship: string | null;
  cabinType: string | null;
  cruiseName: string | null;
  cruiseDate: string | null;
  itinerary: Array<{ day: number; description: string | null; subDescription: string | null }>;
}

export interface BookingUpsellRow {
  upsellType: string;
  description: string | null;
  quantity: number;
}
