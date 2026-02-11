import { db } from "../config/database";
import {
  booking, booking_flights, booking_accomodation, booking_transfers,
  booking_car_hire, booking_attraction_ticket, booking_lounge_pass,
  booking_airport_parking, booking_cruise, booking_cruise_item_extra,
  booking_cruise_itinerary, passengers, deal_images,
} from "@shared/schema";
import type { Booking, InsertBooking } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import {
  buildLookupMaps, enrichQuoteOrBooking, enrichFlights, enrichAccommodations,
  enrichTransfers, enrichCarHires, enrichAttractionTickets, enrichLoungePasses,
  enrichAirportParkings, enrichCruises,
} from "../utils/lookup-resolver";

export const bookingRepository = {
  async findById(id: string): Promise<Booking | undefined> {
    const [result] = await db.select().from(booking).where(eq(booking.id, id)).limit(1);
    return result;
  },

  async findByTransactionId(transactionId: string): Promise<Booking | undefined> {
    const [result] = await db.select().from(booking).where(eq(booking.transaction_id, transactionId)).limit(1);
    return result;
  },

  async findAll(): Promise<Booking[]> {
    return await db.select().from(booking).orderBy(desc(booking.date_created));
  },

  async create(data: InsertBooking): Promise<Booking> {
    const [result] = await db.insert(booking).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertBooking>): Promise<Booking | undefined> {
    const [result] = await db.update(booking).set(data).where(eq(booking.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(booking).where(eq(booking.id, id));
  },

  async findWithDetails(id: string) {
    const [b] = await db.select().from(booking).where(eq(booking.id, id)).limit(1);
    if (!b) return undefined;

    const [maps, flights, accommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings, cruises, passengerList, images] = await Promise.all([
      buildLookupMaps(),
      db.select().from(booking_flights).where(eq(booking_flights.booking_id, id)),
      db.select().from(booking_accomodation).where(eq(booking_accomodation.booking_id, id)),
      db.select().from(booking_transfers).where(eq(booking_transfers.booking_id, id)),
      db.select().from(booking_car_hire).where(eq(booking_car_hire.booking_id, id)),
      db.select().from(booking_attraction_ticket).where(eq(booking_attraction_ticket.booking_id, id)),
      db.select().from(booking_lounge_pass).where(eq(booking_lounge_pass.booking_id, id)),
      db.select().from(booking_airport_parking).where(eq(booking_airport_parking.booking_id, id)),
      db.select().from(booking_cruise).where(eq(booking_cruise.booking_id, id)),
      db.select().from(passengers).where(eq(passengers.booking_id, id)),
      db.select().from(deal_images).where(eq(deal_images.owner_id, id)),
    ]);

    return {
      ...enrichQuoteOrBooking(b, maps),
      flights: enrichFlights(flights, maps),
      accommodations: enrichAccommodations(accommodations, maps),
      transfers: enrichTransfers(transfers, maps),
      carHires: enrichCarHires(carHires, maps),
      attractionTickets: enrichAttractionTickets(attractionTickets, maps),
      loungePasses: enrichLoungePasses(loungePasses, maps),
      airportParkings: enrichAirportParkings(airportParkings, maps),
      cruises: enrichCruises(cruises, maps),
      passengers: passengerList,
      images,
    };
  },

  async addFlight(data: any) {
    const [result] = await db.insert(booking_flights).values(data).returning();
    return result;
  },

  async removeFlight(id: string): Promise<void> {
    await db.delete(booking_flights).where(eq(booking_flights.id, id));
  },

  async addAccommodation(data: any) {
    const [result] = await db.insert(booking_accomodation).values(data).returning();
    return result;
  },

  async removeAccommodation(id: string): Promise<void> {
    await db.delete(booking_accomodation).where(eq(booking_accomodation.id, id));
  },

  async addTransfer(data: any) {
    const [result] = await db.insert(booking_transfers).values(data).returning();
    return result;
  },

  async removeTransfer(id: string): Promise<void> {
    await db.delete(booking_transfers).where(eq(booking_transfers.id, id));
  },
};
