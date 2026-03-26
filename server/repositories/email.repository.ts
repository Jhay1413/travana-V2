import { db } from "../config/database";
import { emailAccounts } from "@shared/schema";
import type { EmailAccount, InsertEmailAccount } from "../types/email";
import { eq } from "drizzle-orm";

export const emailRepository = {
  async findFirst(): Promise<EmailAccount | undefined> {
    const results = await db.select().from(emailAccounts).limit(1);
    return results[0];
  },

  async findAllByUserId(userId: string): Promise<EmailAccount[]> {
    return await db.select().from(emailAccounts).where(eq(emailAccounts.userId, userId));
  },

  async findById(id: string): Promise<EmailAccount | undefined> {
    const results = await db.select().from(emailAccounts).where(eq(emailAccounts.id, id)).limit(1);
    return results[0];
  },

  async create(data: InsertEmailAccount): Promise<EmailAccount> {
    const [result] = await db.insert(emailAccounts).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertEmailAccount>): Promise<EmailAccount | undefined> {
    const [result] = await db
      .update(emailAccounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailAccounts.id, id))
      .returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(emailAccounts).where(eq(emailAccounts.id, id));
  },
};
