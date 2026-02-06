import { db } from "../config/database";
import { quotes, type Quote, type InsertQuote } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const quoteRepository = {
  async findById(id: string): Promise<Quote | undefined> {
    const [result] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<Quote[]> {
    return await db.select().from(quotes).orderBy(desc(quotes.createdAt));
  },

  async findByClientId(clientId: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(eq(quotes.clientId, clientId)).orderBy(desc(quotes.createdAt));
  },

  async findByStatus(status: string): Promise<Quote[]> {
    return await db.select().from(quotes).where(eq(quotes.status, status)).orderBy(desc(quotes.createdAt));
  },

  async create(quote: InsertQuote): Promise<Quote> {
    const [result] = await db.insert(quotes).values(quote).returning();
    return result;
  },

  async update(id: string, quote: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [result] = await db.update(quotes).set(quote).where(eq(quotes.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  },
};
