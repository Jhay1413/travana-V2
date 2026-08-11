import { db } from "../../config/database";
import { quoteImages, deal_images, accommodation_images, lodge_images } from "@shared/schema";
import { eq, and, asc, sql } from "drizzle-orm";
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

      // New images append to the end of the existing order. Read inside the
      // same transaction as the insert so two concurrent adds can't both claim
      // the same starting position.
      const [{ maxPosition } = { maxPosition: null }] = await tx
        .select({ maxPosition: sql<number | null>`MAX(${quoteImages.position})` })
        .from(quoteImages)
        .where(eq(quoteImages.quoteId, quoteId));
      const nextPosition = (maxPosition ?? -1) + 1;

      const imagesToInsert = imageUrls.map((url, index) => ({
        id: randomUUID(),
        quoteId,
        url,
        isPrimary: !hasPrimary && index === 0,
        position: nextPosition + index,
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
      .where(eq(quoteImages.quoteId, quoteId))
      // `id` is a random UUID, so it's only a stable tiebreak, not an order —
      // `position` is what actually carries the arrangement.
      .orderBy(asc(quoteImages.position), asc(quoteImages.id));

    return images;
  },

  /**
   * Apply a user-chosen order. `imageIds` is the full desired sequence; each row
   * takes its index as its new position. Ids that don't belong to this quote are
   * ignored — the merged gallery can hand back ids from the shared
   * accommodation/lodge libraries, which have no per-quote row to reorder.
   *
   * Runs as one transaction so a partial write can't leave the gallery in a
   * half-reordered state.
   */
  async reorder(quoteId: string, imageIds: string[]): Promise<void> {
    if (imageIds.length === 0) return;
    await db.transaction(async (tx) => {
      for (const [index, imageId] of imageIds.entries()) {
        await tx
          .update(quoteImages)
          .set({ position: index })
          .where(and(eq(quoteImages.id, imageId), eq(quoteImages.quoteId, quoteId)));
      }
    });
  },

  /**
   * Reorder by URL rather than id. The quote edit form knows the arrangement it
   * wants before the new images exist as rows, so it has URLs but no ids —
   * matching on URL lets one call set positions for both freshly-inserted and
   * already-saved images. URLs not belonging to this quote simply match nothing.
   *
   * The first URL also becomes the primary image. This path is only ever used by
   * the quote form, whose picker states "the first image is used as the main
   * photo" and expresses "set as main" as a move to the front — without this the
   * flag would keep pointing at whatever was primary when the quote was created,
   * and readers that sort on isPrimary (the social-post cards) would keep showing
   * the old image. The Arrange dialog reorders by id instead and has its own
   * explicit primary control, so its ordering deliberately leaves the flag alone.
   */
  async reorderByUrl(quoteId: string, imageUrls: string[]): Promise<void> {
    if (imageUrls.length === 0) return;
    await db.transaction(async (tx) => {
      for (const [index, url] of imageUrls.entries()) {
        await tx
          .update(quoteImages)
          .set({ position: index })
          .where(and(eq(quoteImages.quoteId, quoteId), eq(quoteImages.url, url)));
      }

      // Resolve the new primary to a single row id first: the same URL can appear
      // on more than one row, and a URL from the shared accommodation/lodge
      // libraries has no row here at all — in which case the existing primary is
      // left untouched rather than cleared, which would leave the quote with none.
      const [newPrimary] = await tx
        .select({ id: quoteImages.id })
        .from(quoteImages)
        .where(and(eq(quoteImages.quoteId, quoteId), eq(quoteImages.url, imageUrls[0])))
        .orderBy(asc(quoteImages.id))
        .limit(1);

      if (!newPrimary) return;

      await tx
        .update(quoteImages)
        .set({ isPrimary: false })
        .where(and(eq(quoteImages.quoteId, quoteId), eq(quoteImages.isPrimary, true)));

      await tx
        .update(quoteImages)
        .set({ isPrimary: true })
        .where(eq(quoteImages.id, newPrimary.id));
    });
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
