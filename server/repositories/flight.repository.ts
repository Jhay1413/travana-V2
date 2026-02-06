import { db } from "../config/database";
import { flights, type Flight, type InsertFlight } from "@shared/schema";
import { eq } from "drizzle-orm";

export const flightRepository = {
  async findByQuoteId(quoteId: string): Promise<Flight[]> {
    return await db.select().from(flights).where(eq(flights.quoteId, quoteId));
  },

  async create(flight: InsertFlight): Promise<Flight> {
    const [result] = await db.insert(flights).values(flight).returning();
    return result;
  },

  async update(id: string, flight: Partial<InsertFlight>): Promise<Flight | undefined> {
    const [result] = await db.update(flights).set(flight).where(eq(flights.id, id)).returning();
    return result;
  },
};
