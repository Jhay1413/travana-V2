import { db } from "../../config/database";
import { quoteImages, deal_images, accommodation_images, lodge_images } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export const quoteImageRepository = {
  /**
   * Add multiple images to a quote.
   *
   * The hasPrimary check + insert is wrapped in a single db.transaction so the
   * read and write are atomic — without this, two concurrent addImages calls
   * for the same quote could both read hasPrimary=false and each insert their
   * own primary image, leaving two rows marked primary.
   */
  async addImages(quoteId: string, imageUrls: string[]) {
    return db.transaction(async (tx) => {
      const existing = await tx
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

      const insertedImages = await tx
        .insert(quoteImages)
        .values(imagesToInsert)
        .returning();

      return insertedImages;
    });
  },

  /**
   * Get the stored URL for a single quote image (used to clean up S3 on delete).
   *
   * A quote's merged `images` list can hand back an id from quoteImages,
   * deal_images, accommodation_images or lodge_images (see `deleteImage`
   * below for why), so the lookup mirrors that same fallback order/scoping:
   * quoteImages and deal_images are scoped to this quote, while
   * accommodation_images / lodge_images are master records matched by id alone.
   */
  async getImageUrl(quoteId: string, imageId: string): Promise<string | null> {
    const [quoteImageRow] = await db
      .select({ url: quoteImages.url })
      .from(quoteImages)
      .where(and(eq(quoteImages.id, imageId), eq(quoteImages.quoteId, quoteId)))
      .limit(1);
    if (quoteImageRow?.url) return quoteImageRow.url;

    const [dealImageRow] = await db
      .select({ url: deal_images.image_url })
      .from(deal_images)
      .where(and(eq(deal_images.id, imageId), eq(deal_images.owner_id, quoteId)))
      .limit(1);
    if (dealImageRow?.url) return dealImageRow.url;

    const [accommodationRow] = await db
      .select({ url: accommodation_images.image_url })
      .from(accommodation_images)
      .where(eq(accommodation_images.id, imageId))
      .limit(1);
    if (accommodationRow?.url) return accommodationRow.url;

    const [lodgeRow] = await db
      .select({ url: lodge_images.image_url })
      .from(lodge_images)
      .where(eq(lodge_images.id, imageId))
      .limit(1);
    return lodgeRow?.url ?? null;
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
   * Check whether any row across quote_images, accommodation_images,
   * lodge_images or deal_images still references this exact URL string.
   * Used to guard S3 deletion — accommodation_images / lodge_images are
   * master inventory tables shared across every quote for that hotel/lodge,
   * so an S3 object must not be removed while any of them still points at it.
   */
  async isUrlReferenced(url: string): Promise<boolean> {
    const [quoteImageRow] = await db
      .select({ id: quoteImages.id })
      .from(quoteImages)
      .where(eq(quoteImages.url, url))
      .limit(1);
    if (quoteImageRow) return true;

    const [accommodationRow] = await db
      .select({ id: accommodation_images.id })
      .from(accommodation_images)
      .where(eq(accommodation_images.image_url, url))
      .limit(1);
    if (accommodationRow) return true;

    const [lodgeRow] = await db
      .select({ id: lodge_images.id })
      .from(lodge_images)
      .where(eq(lodge_images.image_url, url))
      .limit(1);
    if (lodgeRow) return true;

    const [dealImageRow] = await db
      .select({ id: deal_images.id })
      .from(deal_images)
      .where(eq(deal_images.image_url, url))
      .limit(1);
    return !!dealImageRow;
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
