import { db } from "../../config/database";
import { bookingImages, deal_images, accommodation_images, lodge_images } from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export const bookingImageRepository = {
  async addImages(bookingId: string, imageUrls: string[]) {
    const existing = await db
      .select({ id: bookingImages.id })
      .from(bookingImages)
      .where(and(eq(bookingImages.bookingId, bookingId), eq(bookingImages.isPrimary, true)));

    const hasPrimary = existing.length > 0;

    // New images append to the end of the existing order.
    const [{ maxPosition } = { maxPosition: null }] = await db
      .select({ maxPosition: sql<number | null>`MAX(${bookingImages.position})` })
      .from(bookingImages)
      .where(eq(bookingImages.bookingId, bookingId));
    const nextPosition = (maxPosition ?? -1) + 1;

    const imagesToInsert = imageUrls.map((url, index) => ({
      id: randomUUID(),
      bookingId,
      url,
      isPrimary: !hasPrimary && index === 0,
      position: nextPosition + index,
    }));

    const insertedImages = await db
      .insert(bookingImages)
      .values(imagesToInsert)
      .returning();

    return insertedImages;
  },

  /**
   * Apply a user-chosen order — see quoteImageRepository.reorder. Ids not
   * belonging to this booking are ignored, since the merged gallery can hand
   * back ids from the shared accommodation/lodge libraries.
   */
  async reorder(bookingId: string, imageIds: string[]): Promise<void> {
    if (imageIds.length === 0) return;
    await db.transaction(async (tx) => {
      for (const [index, imageId] of imageIds.entries()) {
        await tx
          .update(bookingImages)
          .set({ position: index })
          .where(and(eq(bookingImages.id, imageId), eq(bookingImages.bookingId, bookingId)));
      }
    });
  },

  /**
   * Get the stored URL for a single booking image (used to clean up S3 on delete).
   */
  async getImageUrl(bookingId: string, imageId: string): Promise<string | null> {
    const [row] = await db
      .select({ url: bookingImages.url })
      .from(bookingImages)
      .where(and(eq(bookingImages.id, imageId), eq(bookingImages.bookingId, bookingId)))
      .limit(1);
    return row?.url ?? null;
  },

  async getByBookingId(bookingId: string) {
    const images = await db
      .select()
      .from(bookingImages)
      .where(eq(bookingImages.bookingId, bookingId))
      .orderBy(asc(bookingImages.position), asc(bookingImages.id));

    return images;
  },

  /** Reorder by URL — see quoteImageRepository.reorderByUrl. */
  async reorderByUrl(bookingId: string, imageUrls: string[]): Promise<void> {
    if (imageUrls.length === 0) return;
    await db.transaction(async (tx) => {
      for (const [index, url] of imageUrls.entries()) {
        await tx
          .update(bookingImages)
          .set({ position: index })
          .where(and(eq(bookingImages.bookingId, bookingId), eq(bookingImages.url, url)));
      }
    });
  },

  /**
   * Delete a specific image THIS booking owns. A booking's images array is a merge of bookingImages,
   * deal_images, accommodation_images and lodge_images, but only the first two belong to the booking.
   * The accommodation_images / lodge_images rows are shared master records and are NEVER deleted from here.
   */
  async deleteImage(bookingId: string, imageId: string) {
    await Promise.all([
      db.delete(bookingImages).where(and(eq(bookingImages.id, imageId), eq(bookingImages.bookingId, bookingId))),
      db.delete(deal_images).where(and(eq(deal_images.id, imageId), eq(deal_images.owner_id, bookingId))),
    ]);
  },

  /** True when any booking_images row still points at this exact URL (other tables: quoteImageRepository.isUrlReferenced). */
  async isUrlReferencedByBooking(url: string): Promise<boolean> {
    const [row] = await db.select({ id: bookingImages.id }).from(bookingImages).where(eq(bookingImages.url, url)).limit(1);
    return !!row;
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
