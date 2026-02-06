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
};
