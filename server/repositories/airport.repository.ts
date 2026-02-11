import { db } from "../config/database";
import { airport } from "@shared/schema";
import { eq } from "drizzle-orm";

type AirportRecord = typeof airport.$inferSelect;
type InsertAirportRecord = typeof airport.$inferInsert;

export const airportRepository = {
  async findById(id: string): Promise<AirportRecord | undefined> {
    const [result] = await db.select().from(airport).where(eq(airport.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<AirportRecord[]> {
    return await db.select().from(airport).orderBy(airport.airport_name);
  },

  async create(airportData: InsertAirportRecord): Promise<AirportRecord> {
    const [result] = await db.insert(airport).values(airportData).returning();
    return result;
  },

  async update(id: string, airportData: Partial<InsertAirportRecord>): Promise<AirportRecord | undefined> {
    const [result] = await db.update(airport).set(airportData).where(eq(airport.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(airport).where(eq(airport.id, id));
  },
};
