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
