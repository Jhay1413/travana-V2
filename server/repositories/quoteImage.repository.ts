import { db } from "../config/database";
import { quoteImages, type QuoteImage, type InsertQuoteImage } from "@shared/schema";
import { eq } from "drizzle-orm";

export const quoteImageRepository = {
  async findByQuoteId(quoteId: string): Promise<QuoteImage[]> {
    return await db.select().from(quoteImages).where(eq(quoteImages.quoteId, quoteId));
  },

  async create(image: InsertQuoteImage): Promise<QuoteImage> {
    const [result] = await db.insert(quoteImages).values(image).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(quoteImages).where(eq(quoteImages.id, id));
  },

  async setPrimary(id: string, quoteId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(quoteImages).set({ isPrimary: false }).where(eq(quoteImages.quoteId, quoteId));
      await tx.update(quoteImages).set({ isPrimary: true }).where(eq(quoteImages.id, id));
    });
  },
};
