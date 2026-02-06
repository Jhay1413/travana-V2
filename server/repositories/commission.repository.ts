import { db } from "../config/database";
import { commissions, type Commission, type InsertCommission } from "@shared/schema";
import { eq } from "drizzle-orm";

export const commissionRepository = {
  async findByQuoteId(quoteId: string): Promise<Commission | undefined> {
    const [result] = await db.select().from(commissions).where(eq(commissions.quoteId, quoteId)).limit(1);
    return result;
  },

  async create(commission: InsertCommission): Promise<Commission> {
    const [result] = await db.insert(commissions).values(commission).returning();
    return result;
  },

  async update(id: string, commission: Partial<InsertCommission>): Promise<Commission | undefined> {
    const [result] = await db.update(commissions).set(commission).where(eq(commissions.id, id)).returning();
    return result;
  },
};
