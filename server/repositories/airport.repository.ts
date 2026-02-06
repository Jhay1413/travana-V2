import { db } from "../config/database";
import { airports, type Airport, type InsertAirport } from "@shared/schema";
import { eq } from "drizzle-orm";

export const airportRepository = {
  async findById(id: string): Promise<Airport | undefined> {
    const [result] = await db.select().from(airports).where(eq(airports.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<Airport[]> {
    return await db.select().from(airports).orderBy(airports.name);
  },

  async create(airport: InsertAirport): Promise<Airport> {
    const [result] = await db.insert(airports).values(airport).returning();
    return result;
  },

  async update(id: string, airport: Partial<InsertAirport>): Promise<Airport | undefined> {
    const [result] = await db.update(airports).set(airport).where(eq(airports.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(airports).where(eq(airports.id, id));
  },
};
