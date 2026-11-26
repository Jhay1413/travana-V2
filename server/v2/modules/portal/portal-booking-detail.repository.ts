// Intentionally outside the shop/homeworker partition: portal reads are client-facing and session-gated, not staff reads.
import { db } from '../../config/database';
import {
  accomodation_list,
  airport,
  board_basis,
  booking,
  booking_accomodation,
  booking_airport_parking,
  booking_attraction_ticket,
  booking_car_hire,
  booking_cruise,
  booking_cruise_itinerary,
  booking_flights,
  booking_lounge_pass,
  booking_transfers,
  booking_upsell,
  country,
  destination,
  resorts,
  room_type,
  tour_operator,
  transaction,
  user,
} from '@shared/schema';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { bookingExtrasTotalExpr } from '../../utils/commission-sql';
import { liveBookingWhere } from './portal.repository';
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

/** The room type column holds either a room type id or free text; this matches an id. */
const UUID_PATTERN = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

const departAirport = alias(airport, 'booking_depart_airport');
const arriveAirport = alias(airport, 'booking_arrive_airport');
const loungeAirport = alias(airport, 'booking_lounge_airport');
const parkingAirport = alias(airport, 'booking_parking_airport');

/** "Name (CODE)", or just the name when the airport has no code: the same label the quote shows. */
const airportLabel = (a: { airport_code: AnyPgColumn; airport_name: AnyPgColumn }) =>
  sql<string | null>`CASE WHEN ${a.airport_code} IS NOT NULL AND ${a.airport_code} <> '' THEN concat(${a.airport_name}, ' (', ${a.airport_code}, ')') ELSE ${a.airport_name} END`;

/**
 * Reads for the customer's booking detail. Every select names the columns it returns, so cost, commission,
 * booking_ref, notes and the like are never read at all.
 */
export const portalBookingDetailRepository = {
  /**
   * The booking, only when it is one of THIS customer's (through the deal's client) and live (see liveBookingWhere).
   * Anything else is null: there is no way to tell "not yours" from "does not exist".
   */
  async findOwnedHeader(clientId: string, bookingId: string): Promise<BookingHeaderRow | null> {
    const [row] = await db
      .select({
        bookingId: booking.id,
        quoteId: booking.quote_id,
        title: booking.title,
        haysRef: booking.hays_ref,
        supplierRef: booking.supplier_ref,
        salesPrice: booking.sales_price,
        discounts: booking.discounts,
        serviceCharge: booking.service_charge,
        extrasTotal: bookingExtrasTotalExpr(),
        adult: booking.adult,
        child: booking.child,
        infant: booking.infant,
        travelDate: booking.travel_date,
        numNights: booking.num_of_nights,
        operatorName: tour_operator.name,
        boardName: board_basis.type,
        destinationName: destination.name,
        countryName: country.country_name,
        resortName: resorts.name,
        agentFirstName: user.firstName,
        agentLastName: user.lastName,
        agentAvatar: user.image,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .leftJoin(tour_operator, eq(booking.main_tour_operator_id, tour_operator.id))
      .leftJoin(booking_accomodation, and(eq(booking_accomodation.booking_id, booking.id), eq(booking_accomodation.is_primary, true)))
      .leftJoin(board_basis, eq(booking_accomodation.board_basis_id, board_basis.id))
      .leftJoin(accomodation_list, eq(booking_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .leftJoin(user, eq(transaction.user_id, user.id))
      .where(and(eq(booking.id, bookingId), eq(transaction.client_id, clientId), liveBookingWhere()))
      .limit(1);
    return row ?? null;
  },

  async findFlights(bookingId: string): Promise<BookingFlightRow[]> {
    return db
      .select({
        flightType: booking_flights.flight_type,
        flightNumber: booking_flights.flight_number,
        departingAirport: airportLabel(departAirport),
        arrivalAirport: airportLabel(arriveAirport),
        departureDateTime: booking_flights.departure_date_time,
        arrivalDateTime: booking_flights.arrival_date_time,
      })
      .from(booking_flights)
      .leftJoin(departAirport, eq(booking_flights.departing_airport_id, departAirport.id))
      .leftJoin(arriveAirport, eq(booking_flights.arrival_airport_id, arriveAirport.id))
      .where(eq(booking_flights.booking_id, bookingId))
      .orderBy(asc(booking_flights.departure_date_time));
  },

  async findAccommodations(bookingId: string): Promise<BookingAccommodationRow[]> {
    return db
      .select({
        name: accomodation_list.name,
        boardBasis: board_basis.type,
        // The room type's name; the stored free text when it is not an id; NEVER a raw id that matches no room type.
        roomType: sql<string | null>`CASE WHEN ${room_type.name} IS NOT NULL THEN ${room_type.name} WHEN ${booking_accomodation.room_type} ~ ${UUID_PATTERN} THEN NULL ELSE ${booking_accomodation.room_type} END`,
        checkInDateTime: booking_accomodation.check_in_date_time,
        resortName: resorts.name,
        isPrimary: booking_accomodation.is_primary,
      })
      .from(booking_accomodation)
      .leftJoin(accomodation_list, eq(booking_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(board_basis, eq(booking_accomodation.board_basis_id, board_basis.id))
      .leftJoin(
        room_type,
        sql`CASE WHEN ${booking_accomodation.room_type} ~ ${UUID_PATTERN} THEN ${booking_accomodation.room_type}::uuid ELSE NULL END = ${room_type.id}`,
      )
      .where(eq(booking_accomodation.booking_id, bookingId))
      .orderBy(asc(booking_accomodation.check_in_date_time));
  },

  async findTransfers(bookingId: string): Promise<BookingTransferRow[]> {
    return db
      .select({
        pickUp: booking_transfers.pick_up_location,
        dropOff: booking_transfers.drop_off_location,
        pickUpTime: booking_transfers.pick_up_time,
        dropOffTime: booking_transfers.drop_off_time,
      })
      .from(booking_transfers)
      .where(eq(booking_transfers.booking_id, bookingId));
  },

  async findCarHires(bookingId: string): Promise<BookingCarHireRow[]> {
    return db
      .select({
        pickUp: booking_car_hire.pick_up_location,
        dropOff: booking_car_hire.drop_off_location,
        pickUpTime: booking_car_hire.pick_up_time,
        dropOffTime: booking_car_hire.drop_off_time,
        numDays: booking_car_hire.no_of_days,
      })
      .from(booking_car_hire)
      .where(eq(booking_car_hire.booking_id, bookingId));
  },

  async findTickets(bookingId: string): Promise<BookingAttractionRow[]> {
    return db
      .select({
        ticketType: booking_attraction_ticket.ticket_type,
        dateOfVisit: booking_attraction_ticket.date_of_visit,
        numberOfTickets: booking_attraction_ticket.number_of_tickets,
      })
      .from(booking_attraction_ticket)
      .where(eq(booking_attraction_ticket.booking_id, bookingId));
  },

  async findLounges(bookingId: string): Promise<BookingLoungeRow[]> {
    return db
      .select({
        airportName: airportLabel(loungeAirport),
        terminal: booking_lounge_pass.terminal,
        dateOfUsage: booking_lounge_pass.date_of_usage,
      })
      .from(booking_lounge_pass)
      .leftJoin(loungeAirport, eq(booking_lounge_pass.airport_id, loungeAirport.id))
      .where(eq(booking_lounge_pass.booking_id, bookingId));
  },

  async findParkings(bookingId: string): Promise<BookingAirportParkingRow[]> {
    return db
      .select({
        airportName: airportLabel(parkingAirport),
        parkingType: booking_airport_parking.parking_type,
        parkingDate: booking_airport_parking.parking_date,
      })
      .from(booking_airport_parking)
      .leftJoin(parkingAirport, eq(booking_airport_parking.airport_id, parkingAirport.id))
      .where(eq(booking_airport_parking.booking_id, bookingId));
  },

  /** Cruises with their day-by-day itinerary (cabin number, ports of call and the like stay unread). */
  async findCruises(bookingId: string): Promise<BookingCruiseRow[]> {
    const cruises = await db
      .select({
        id: booking_cruise.id,
        cruiseLine: booking_cruise.cruise_line,
        ship: booking_cruise.ship,
        cabinType: booking_cruise.cabin_type,
        cruiseName: booking_cruise.cruise_name,
        cruiseDate: booking_cruise.cruise_date,
      })
      .from(booking_cruise)
      .where(eq(booking_cruise.booking_id, bookingId));
    if (cruises.length === 0) return [];
    const days = await db
      .select({
        cruiseId: booking_cruise_itinerary.booking_cruise_id,
        day: booking_cruise_itinerary.day_number,
        description: booking_cruise_itinerary.description,
        subDescription: booking_cruise_itinerary.sub_description,
      })
      .from(booking_cruise_itinerary)
      .where(inArray(booking_cruise_itinerary.booking_cruise_id, cruises.map((c) => c.id)))
      .orderBy(asc(booking_cruise_itinerary.day_number));
    return cruises.map(({ id, ...c }) => ({
      ...c,
      itinerary: days
        .filter((d) => d.cruiseId === id)
        .map((d) => ({ day: d.day ?? 0, description: d.description, subDescription: d.subDescription })),
    }));
  },

  /** Active extras added after the booking was made: type, description and quantity only (never a price). */
  async findUpsells(bookingId: string): Promise<BookingUpsellRow[]> {
    return db
      .select({ upsellType: booking_upsell.upsell_type, description: booking_upsell.description, quantity: booking_upsell.quantity })
      .from(booking_upsell)
      .where(and(eq(booking_upsell.booking_id, bookingId), eq(booking_upsell.is_active, true)))
      .orderBy(asc(booking_upsell.added_at));
  },
};
