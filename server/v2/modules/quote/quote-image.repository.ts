import { db } from "../../config/database";
import { quoteImages, deal_images, accommodation_images, lodge_images } from "@shared/schema";
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
   * Delete a specific image.
   *
   * A quote's `images` array is a merge of quoteImages, accommodation_images
   * and lodge_images (see quote.repository `getById`), each labelled with the
   * row's own id. The incoming imageId therefore belongs to whichever source
   * table that row came from, so we try the delete against every source. The
   * accommodation_images / lodge_images delete is a global removal because
   * those tables are master records shared across all consumers.
   */
  async deleteImage(quoteId: string, imageId: string) {
    await Promise.all([
      db.delete(quoteImages).where(and(eq(quoteImages.id, imageId), eq(quoteImages.quoteId, quoteId))),
      db.delete(deal_images).where(and(eq(deal_images.id, imageId), eq(deal_images.owner_id, quoteId))),
      db.delete(accommodation_images).where(eq(accommodation_images.id, imageId)),
      db.delete(lodge_images).where(eq(lodge_images.id, imageId)),
    ]);
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
