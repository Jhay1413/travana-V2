import { db } from "../config/database";
import { quoteImages } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const quoteImageRepository = {
  /**
   * Add multiple images to a quote
   */
  async addImages(quoteId: string, imageUrls: string[]) {
    const existing = await db
      .select({ id: quoteImages.id })
      .from(quoteImages)
      .where(and(eq(quoteImages.quoteId, quoteId), eq(quoteImages.isPrimary, true)));

    const hasPrimary = existing.length > 0;

    const imagesToInsert = imageUrls.map((url, index) => ({
      id: randomUUID(),
      quoteId,
      url,
      isPrimary: !hasPrimary && index === 0,
    }));

    const insertedImages = await db
      .insert(quoteImages)
      .values(imagesToInsert)
      .returning();

    return insertedImages;
  },

  /**
   * Get all images for a quote
   */
  async getByQuoteId(quoteId: string) {
    const images = await db
      .select()
      .from(quoteImages)
      .where(eq(quoteImages.quoteId, quoteId));

    return images;
  },

  /**
   * Delete a specific image
   */
  async deleteImage(quoteId: string, imageId: string) {
    await db
      .delete(quoteImages)
      .where(
        and(
          eq(quoteImages.id, imageId),
          eq(quoteImages.quoteId, quoteId)
        )
      );
  },

  /**
   * Set an image as primary (and unset others)
   */
  async setPrimaryImage(quoteId: string, imageId: string) {
    const [target] = await db
      .select({ id: quoteImages.id })
      .from(quoteImages)
      .where(and(eq(quoteImages.id, imageId), eq(quoteImages.quoteId, quoteId)))
      .limit(1);

    if (!target) return undefined;

    await db
      .update(quoteImages)
      .set({ isPrimary: false })
      .where(eq(quoteImages.quoteId, quoteId));

    const [updatedImage] = await db
      .update(quoteImages)
      .set({ isPrimary: true })
      .where(
        and(
          eq(quoteImages.id, imageId),
          eq(quoteImages.quoteId, quoteId)
        )
      )
      .returning();

    return updatedImage;
  },
};
