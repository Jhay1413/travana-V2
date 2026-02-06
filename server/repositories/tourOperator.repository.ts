import { db } from "../config/database";
import { tourOperators, type TourOperator, type InsertTourOperator } from "@shared/schema";
import { eq } from "drizzle-orm";

export const tourOperatorRepository = {
  async findById(id: string): Promise<TourOperator | undefined> {
    const [result] = await db.select().from(tourOperators).where(eq(tourOperators.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<TourOperator[]> {
    return await db.select().from(tourOperators).orderBy(tourOperators.name);
  },

  async create(op: InsertTourOperator): Promise<TourOperator> {
    const [result] = await db.insert(tourOperators).values(op).returning();
    return result;
  },

  async update(id: string, op: Partial<InsertTourOperator>): Promise<TourOperator | undefined> {
    const [result] = await db.update(tourOperators).set({ ...op, updatedAt: new Date() }).where(eq(tourOperators.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(tourOperators).where(eq(tourOperators.id, id));
  },
};
