import { db } from "../config/database";
import { accommodations, type Accommodation, type InsertAccommodation } from "@shared/schema";
import { eq } from "drizzle-orm";

export const accommodationRepository = {
  async findByQuoteId(quoteId: string): Promise<Accommodation | undefined> {
    const [result] = await db.select().from(accommodations).where(eq(accommodations.quoteId, quoteId)).limit(1);
    return result;
  },

  async create(accommodation: InsertAccommodation): Promise<Accommodation> {
    const [result] = await db.insert(accommodations).values(accommodation).returning();
    return result;
  },

  async update(id: string, accommodation: Partial<InsertAccommodation>): Promise<Accommodation | undefined> {
    const [result] = await db.update(accommodations).set(accommodation).where(eq(accommodations.id, id)).returning();
    return result;
  },
};
