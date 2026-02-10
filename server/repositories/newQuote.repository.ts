import { db } from "../config/database";
import {
  quote, quote_flights, quote_accomodation, quote_transfers, quote_car_hire,
  quote_attraction_ticket, quote_lounge_pass, quote_airport_parking,
  quote_cruise, quote_cruise_item_extra, quote_cruise_itinerary,
  passengers, deal_images,
} from "@shared/schema";
import type { Quote, InsertQuote, QuoteFlight, InsertQuoteFlight, QuoteAccomodation, InsertQuoteAccomodation } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const newQuoteRepository = {
  async findById(id: string): Promise<Quote | undefined> {
    const [result] = await db.select().from(quote).where(eq(quote.id, id)).limit(1);
    return result;
  },

  async findByTransactionId(transactionId: string): Promise<Quote[]> {
    return await db.select().from(quote).where(eq(quote.transaction_id, transactionId)).orderBy(desc(quote.date_created));
  },

  async findAll(): Promise<Quote[]> {
    return await db.select().from(quote).orderBy(desc(quote.date_created));
  },

  async findByStatus(status: string): Promise<Quote[]> {
    return await db.select().from(quote).where(eq(quote.quote_status, status as any)).orderBy(desc(quote.date_created));
  },

  async create(data: InsertQuote): Promise<Quote> {
    const [result] = await db.insert(quote).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [result] = await db.update(quote).set(data).where(eq(quote.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(quote).where(eq(quote.id, id));
  },

  async findWithDetails(id: string) {
    const [q] = await db.select().from(quote).where(eq(quote.id, id)).limit(1);
    if (!q) return undefined;

    const [flights, accommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings, cruises, passengerList, images] = await Promise.all([
      db.select().from(quote_flights).where(eq(quote_flights.quote_id, id)),
      db.select().from(quote_accomodation).where(eq(quote_accomodation.quote_id, id)),
      db.select().from(quote_transfers).where(eq(quote_transfers.quote_id, id)),
      db.select().from(quote_car_hire).where(eq(quote_car_hire.quote_id, id)),
      db.select().from(quote_attraction_ticket).where(eq(quote_attraction_ticket.quote_id, id)),
      db.select().from(quote_lounge_pass).where(eq(quote_lounge_pass.quote_id, id)),
      db.select().from(quote_airport_parking).where(eq(quote_airport_parking.quote_id, id)),
      db.select().from(quote_cruise).where(eq(quote_cruise.quote_id, id)),
      db.select().from(passengers).where(eq(passengers.quote_id, id)),
      db.select().from(deal_images).where(eq(deal_images.owner_id, id)),
    ]);

    return {
      ...q,
      flights,
      accommodations,
      transfers,
      carHires,
      attractionTickets,
      loungePasses,
      airportParkings,
      cruises,
      passengers: passengerList,
      images,
    };
  },

  async addFlight(data: InsertQuoteFlight): Promise<QuoteFlight> {
    const [result] = await db.insert(quote_flights).values(data).returning();
    return result;
  },

  async updateFlight(id: string, data: Partial<InsertQuoteFlight>): Promise<QuoteFlight | undefined> {
    const [result] = await db.update(quote_flights).set(data).where(eq(quote_flights.id, id)).returning();
    return result;
  },

  async removeFlight(id: string): Promise<void> {
    await db.delete(quote_flights).where(eq(quote_flights.id, id));
  },

  async addAccommodation(data: InsertQuoteAccomodation): Promise<QuoteAccomodation> {
    const [result] = await db.insert(quote_accomodation).values(data).returning();
    return result;
  },

  async updateAccommodation(id: string, data: Partial<InsertQuoteAccomodation>): Promise<QuoteAccomodation | undefined> {
    const [result] = await db.update(quote_accomodation).set(data).where(eq(quote_accomodation.id, id)).returning();
    return result;
  },

  async removeAccommodation(id: string): Promise<void> {
    await db.delete(quote_accomodation).where(eq(quote_accomodation.id, id));
  },

  async addTransfer(data: any) {
    const [result] = await db.insert(quote_transfers).values(data).returning();
    return result;
  },

  async removeTransfer(id: string): Promise<void> {
    await db.delete(quote_transfers).where(eq(quote_transfers.id, id));
  },

  async addCarHire(data: any) {
    const [result] = await db.insert(quote_car_hire).values(data).returning();
    return result;
  },

  async removeCarHire(id: string): Promise<void> {
    await db.delete(quote_car_hire).where(eq(quote_car_hire.id, id));
  },

  async addAttractionTicket(data: any) {
    const [result] = await db.insert(quote_attraction_ticket).values(data).returning();
    return result;
  },

  async removeAttractionTicket(id: string): Promise<void> {
    await db.delete(quote_attraction_ticket).where(eq(quote_attraction_ticket.id, id));
  },

  async addLoungePass(data: any) {
    const [result] = await db.insert(quote_lounge_pass).values(data).returning();
    return result;
  },

  async removeLoungePass(id: string): Promise<void> {
    await db.delete(quote_lounge_pass).where(eq(quote_lounge_pass.id, id));
  },

  async addAirportParking(data: any) {
    const [result] = await db.insert(quote_airport_parking).values(data).returning();
    return result;
  },

  async removeAirportParking(id: string): Promise<void> {
    await db.delete(quote_airport_parking).where(eq(quote_airport_parking.id, id));
  },

  async addPassenger(data: any) {
    const [result] = await db.insert(passengers).values(data).returning();
    return result;
  },

  async removePassenger(id: string): Promise<void> {
    await db.delete(passengers).where(eq(passengers.id, id));
  },
};
