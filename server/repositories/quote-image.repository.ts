import { db } from "../config/database";
import { quoteImages } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const quoteImageRepository = {
  /**
   * Add multiple images to a quote
   */
  async addImages(quoteId: string, imageUrls: string[]) {
    console.log(`📸 REPOSITORY - addImages called for quote ${quoteId}`);
    console.log(`📸 REPOSITORY - Number of images to insert:`, imageUrls.length);
    console.log(`📸 REPOSITORY - Image URLs:`, imageUrls);
    
    const imagesToInsert = imageUrls.map((url, index) => ({
      id: randomUUID(),
      quoteId,
      url,
      // First image is primary by default
      isPrimary: index === 0,
    }));

    console.log(`📸 REPOSITORY - Images to insert:`, imagesToInsert);

    const insertedImages = await db
      .insert(quoteImages)
      .values(imagesToInsert)
      .returning();

    console.log(`📸 REPOSITORY - Successfully inserted ${insertedImages.length} images`);
    
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
    // First, unset all images for this quote
    await db
      .update(quoteImages)
      .set({ isPrimary: false })
      .where(eq(quoteImages.quoteId, quoteId));

    // Then set the specified image as primary
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
