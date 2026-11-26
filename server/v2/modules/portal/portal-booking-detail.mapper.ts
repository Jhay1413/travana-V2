import type { PortalBookingDetail, PortalBookingExtra, PortalTripStatus } from '@shared/portal-bookings';
import { bookingDestination, bookingTitle } from './portal-booking-title';
import { customerPrice } from '../../utils/customer-price';
import { addNights, toIso } from './portal-quotes.mapper';
import { dayNumber, toIsoDay, ukDay } from './portal-summary.mapper';
import type {
  BookingAccommodationRow,
  BookingAirportParkingRow,
  BookingAttractionRow,
  BookingCarHireRow,
  BookingCruiseRow,
  BookingFlightRow,
  BookingHeaderRow,
  BookingLoungeRow,
  BookingTransferRow,
  BookingUpsellRow,
} from './portal-booking-detail.types';

/**
 * Where a trip is by UK calendar day. A booking with no recorded length counts as a one-day trip (the rule the
 * Home summary uses), so it is "in progress" on its first day and "past" the day after.
 */
export function tripTiming(startDate: string | Date, endDate: string | Date | null, now: Date): { status: PortalTripStatus; daysToGo: number } {
  const today = dayNumber(ukDay(now));
  const start = dayNumber(toIsoDay(startDate));
  const end = endDate ? dayNumber(toIsoDay(endDate)) : start;
  const daysToGo = start - today;
  if (start > today) return { status: 'upcoming', daysToGo };
  if (end >= today) return { status: 'in_progress', daysToGo };
  return { status: 'past', daysToGo };
}

/** Upsell types that are an itinerary item for the customer. A FEE is the agency's own charge, never shown. */
const CUSTOMER_UPSELL_TYPES = new Set(['EXTRA_NIGHTS', 'TRANSFER', 'LOUNGE', 'PARKING', 'OTHER']);

const UPSELL_LABEL: Record<string, string> = {
  EXTRA_NIGHTS: 'Extra nights',
  TRANSFER: 'Transfer',
  LOUNGE: 'Airport lounge',
  PARKING: 'Airport parking',
  OTHER: 'Extra',
};

export function buildExtras(rows: BookingUpsellRow[]): PortalBookingExtra[] {
  return rows
    .filter((r) => CUSTOMER_UPSELL_TYPES.has(r.upsellType))
    .map((r) => ({
      type: UPSELL_LABEL[r.upsellType] ?? 'Extra',
      description: (r.description ?? '').trim(),
      quantity: r.quantity > 0 ? r.quantity : 1,
    }));
}

export interface BookingDetailSource {
  header: BookingHeaderRow;
  flights: BookingFlightRow[];
  accommodations: BookingAccommodationRow[];
  transfers: BookingTransferRow[];
  carHires: BookingCarHireRow[];
  tickets: BookingAttractionRow[];
  lounges: BookingLoungeRow[];
  parkings: BookingAirportParkingRow[];
  cruises: BookingCruiseRow[];
  upsells: BookingUpsellRow[];
  images: Array<{ id: string; url: string; isPrimary: boolean }>;
}

const GENERIC_AGENT = 'Your Travel Agent';

/**
 * The portal's detail of one booking, built field by field (an allowlist): nothing else on a row, and nothing
 * from the cost side, can reach a customer. Item notes are left blank because on a booking they are staff
 * notes. The price comes from the same function as the list.
 */
export function buildBookingDetail(src: BookingDetailSource, now: Date): PortalBookingDetail {
  const h = src.header;
  const travelDate = toIsoDay(h.travelDate);
  const nights = h.numNights && h.numNights > 0 ? h.numNights : null;
  const returnDate = nights ? addNights(travelDate, nights) : null;
  const { total, pricePerPerson } = customerPrice({ ...h, adults: h.adult, children: h.child });
  const timing = tripTiming(travelDate, returnDate, now);
  const agentName = `${h.agentFirstName ?? ''} ${h.agentLastName ?? ''}`.trim();

  return {
    id: h.bookingId,
    title: bookingTitle(h.title, bookingDestination(h.destinationName, h.countryName)),
    destinationName: h.destinationName ?? '',
    countryName: h.countryName ?? '',
    resortName: h.resortName ?? '',
    travelDate,
    returnDate,
    numNights: nights,
    board: h.boardName || null,
    adults: h.adult ?? 0,
    children: h.child ?? 0,
    infants: h.infant ?? 0,
    operatorName: h.operatorName || null,
    bookingReference: h.haysRef || '',
    supplierReference: h.supplierRef || '',
    total,
    pricePerPerson: parseFloat(pricePerPerson.toFixed(2)),
    tripStatus: timing.status,
    daysToGo: timing.daysToGo,
    flights: src.flights.map((f, i) => ({
      flightType: f.flightType,
      flightNumber: f.flightNumber,
      departingAirport: f.departingAirport ?? '',
      arrivalAirport: f.arrivalAirport ?? '',
      departureDateTime: toIso(f.departureDateTime),
      arrivalDateTime: toIso(f.arrivalDateTime),
      // Booking flights have no leg number: the leg is the position among the flights going the same way.
      legOrder: src.flights.slice(0, i + 1).filter((o) => o.flightType === f.flightType).length,
    })),
    accommodations: src.accommodations.map((a) => ({
      name: a.name ?? '',
      boardBasis: a.boardBasis ?? '',
      roomType: a.roomType ?? '',
      checkInDateTime: toIso(a.checkInDateTime),
      resortName: a.resortName ?? '',
    })),
    transfers: src.transfers.map((t) => ({
      from: t.pickUp ?? '',
      to: t.dropOff ?? '',
      pickUpTime: toIso(t.pickUpTime),
      dropOffTime: toIso(t.dropOffTime),
      note: '',
    })),
    carHires: src.carHires.map((c) => ({
      pickupLocation: c.pickUp ?? '',
      dropoffLocation: c.dropOff ?? '',
      pickupTime: toIso(c.pickUpTime),
      dropoffTime: toIso(c.dropOffTime),
      numDays: c.numDays ?? 0,
    })),
    attractionTickets: src.tickets.map((t) => ({
      type: t.ticketType ?? '',
      dateOfVisit: toIso(t.dateOfVisit),
      numberOfTickets: t.numberOfTickets ?? 0,
    })),
    loungePasses: src.lounges.map((l) => ({
      airportName: l.airportName ?? '',
      terminal: l.terminal ?? '',
      dateOfUsage: toIso(l.dateOfUsage),
      note: '',
    })),
    airportParkings: src.parkings.map((p) => ({
      airportName: p.airportName ?? '',
      parkingType: p.parkingType ?? '',
      parkingDate: toIso(p.parkingDate),
    })),
    cruises: src.cruises.map((c) => ({
      cruiseLine: c.cruiseLine ?? '',
      ship: c.ship ?? '',
      cabinType: c.cabinType ?? '',
      cruiseName: c.cruiseName ?? '',
      cruiseDate: c.cruiseDate ?? null,
      itinerary: c.itinerary.map((i) => ({ day: i.day, description: i.description ?? '', subDescription: i.subDescription ?? '' })),
    })),
    extras: buildExtras(src.upsells),
    images: src.images.map((i) => ({ id: i.id, url: i.url, isPrimary: i.isPrimary })),
    agent: { name: agentName || GENERIC_AGENT, avatar: h.agentAvatar || null },
  };
}
