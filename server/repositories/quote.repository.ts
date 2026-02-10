import { db } from "../config/database";
import { quotes } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

type LegacyQuote = typeof quotes.$inferSelect;
type InsertLegacyQuote = typeof quotes.$inferInsert;

export const quoteRepository = {
  async findById(id: string): Promise<LegacyQuote | undefined> {
    const [result] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<LegacyQuote[]> {
    return await db.select().from(quotes).orderBy(desc(quotes.createdAt));
  },

  async findByClientId(clientId: string): Promise<LegacyQuote[]> {
    return await db.select().from(quotes).where(eq(quotes.clientId, clientId)).orderBy(desc(quotes.createdAt));
  },

  async findByStatus(status: string): Promise<LegacyQuote[]> {
    return await db.select().from(quotes).where(eq(quotes.status, status)).orderBy(desc(quotes.createdAt));
  },

  async create(quoteData: InsertLegacyQuote): Promise<LegacyQuote> {
    const [result] = await db.insert(quotes).values(quoteData).returning();
    return result;
  },

  async update(id: string, quoteData: Partial<InsertLegacyQuote>): Promise<LegacyQuote | undefined> {
    const [result] = await db.update(quotes).set(quoteData).where(eq(quotes.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  },

  async findAllUniqueTags(): Promise<string[]> {
    const result = await db.execute(
      sql`SELECT DISTINCT unnest(tags) AS tag FROM quotes WHERE array_length(tags, 1) > 0 ORDER BY tag`
    );
    return (result.rows as { tag: string }[]).map(r => r.tag);
  },
};
