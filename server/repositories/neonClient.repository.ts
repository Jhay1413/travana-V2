import { db } from "../config/database";
import { clientTable, type NeonClient, type InsertClientTable } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const neonClientRepository = {
  async findById(id: string): Promise<NeonClient | undefined> {
    const [result] = await db.select().from(clientTable).where(eq(clientTable.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<NeonClient[]> {
    return await db.select().from(clientTable).orderBy(desc(clientTable.createdAt));
  },

  async create(client: InsertClientTable): Promise<NeonClient> {
    const [result] = await db.insert(clientTable).values(client).returning();
    return result;
  },

  async update(id: string, client: Partial<InsertClientTable>): Promise<NeonClient | undefined> {
    const [result] = await db.update(clientTable).set(client).where(eq(clientTable.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(clientTable).where(eq(clientTable.id, id));
  },
};
