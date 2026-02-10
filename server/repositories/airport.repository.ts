import { db } from "../config/database";
import { airports } from "@shared/schema";
import { eq } from "drizzle-orm";

type LegacyAirport = typeof airports.$inferSelect;
type InsertLegacyAirport = typeof airports.$inferInsert;

export const airportRepository = {
  async findById(id: string): Promise<LegacyAirport | undefined> {
    const [result] = await db.select().from(airports).where(eq(airports.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<LegacyAirport[]> {
    return await db.select().from(airports).orderBy(airports.airport_name);
  },

  async create(airportData: InsertLegacyAirport): Promise<LegacyAirport> {
    const [result] = await db.insert(airports).values(airportData).returning();
    return result;
  },

  async update(id: string, airportData: Partial<InsertLegacyAirport>): Promise<LegacyAirport | undefined> {
    const [result] = await db.update(airports).set(airportData).where(eq(airports.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(airports).where(eq(airports.id, id));
  },
};
