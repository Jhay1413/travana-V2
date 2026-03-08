import { db } from "../config/database";
import { destinationGuruTable } from "@shared/schema";
import type { DestinationGuru, InsertDestinationGuru } from "@shared/schema";
import { eq, ilike } from "drizzle-orm";

export const destinationGuruRepository = {
  async findAll(): Promise<DestinationGuru[]> {
    return db.select().from(destinationGuruTable).orderBy(destinationGuruTable.destination);
  },

  async findById(id: string): Promise<DestinationGuru | undefined> {
    const [result] = await db.select().from(destinationGuruTable).where(eq(destinationGuruTable.id, id)).limit(1);
    return result;
  },

  async findByDestination(destination: string): Promise<DestinationGuru | undefined> {
    const [result] = await db.select().from(destinationGuruTable).where(ilike(destinationGuruTable.destination, destination)).limit(1);
    return result;
  },

  async create(data: InsertDestinationGuru): Promise<DestinationGuru> {
    const [result] = await db.insert(destinationGuruTable).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertDestinationGuru>): Promise<DestinationGuru | undefined> {
    const [result] = await db
      .update(destinationGuruTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(destinationGuruTable.id, id))
      .returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(destinationGuruTable).where(eq(destinationGuruTable.id, id));
  },
};
