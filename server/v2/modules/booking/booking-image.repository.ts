import { db } from "../../config/database";
import { bookingImages, deal_images, accommodation_images, lodge_images } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const bookingImageRepository = {
  async addImages(bookingId: string, imageUrls: string[]) {
    const existing = await db
      .select({ id: bookingImages.id })
      .from(bookingImages)
      .where(and(eq(bookingImages.bookingId, bookingId), eq(bookingImages.isPrimary, true)));

    const hasPrimary = existing.length > 0;

    const imagesToInsert = imageUrls.map((url, index) => ({
      id: randomUUID(),
      bookingId,
      url,
      isPrimary: !hasPrimary && index === 0,
    }));

    const insertedImages = await db
      .insert(bookingImages)
      .values(imagesToInsert)
      .returning();

    return insertedImages;
  },

  async getByBookingId(bookingId: string) {
    const images = await db
      .select()
      .from(bookingImages)
      .where(eq(bookingImages.bookingId, bookingId));

    return images;
  },

  /**
   * Delete a specific image.
   *
   * A booking's `images` array is a merge of bookingImages, deal_images,
   * accommodation_images and lodge_images (see booking.repository `getById`),
   * each labelled with the row's own id. The incoming imageId therefore
   * belongs to whichever source table that row came from, so we try the
   * delete against every source. The accommodation_images / lodge_images
   * delete is a global removal because those tables are master records
   * shared across all consumers.
   */
  async deleteImage(bookingId: string, imageId: string) {
    await Promise.all([
      db.delete(bookingImages).where(and(eq(bookingImages.id, imageId), eq(bookingImages.bookingId, bookingId))),
      db.delete(deal_images).where(and(eq(deal_images.id, imageId), eq(deal_images.owner_id, bookingId))),
      db.delete(accommodation_images).where(eq(accommodation_images.id, imageId)),
      db.delete(lodge_images).where(eq(lodge_images.id, imageId)),
    ]);
  },

  async setPrimaryImage(bookingId: string, imageId: string) {
    const [target] = await db
      .select({ id: bookingImages.id })
      .from(bookingImages)
      .where(and(eq(bookingImages.id, imageId), eq(bookingImages.bookingId, bookingId)))
      .limit(1);

    if (!target) return undefined;

    await db
      .update(bookingImages)
      .set({ isPrimary: false })
      .where(eq(bookingImages.bookingId, bookingId));

    const [updatedImage] = await db
      .update(bookingImages)
      .set({ isPrimary: true })
      .where(
        and(
          eq(bookingImages.id, imageId),
          eq(bookingImages.bookingId, bookingId)
        )
      )
      .returning();

    return updatedImage;
  },
};
