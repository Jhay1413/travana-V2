import { quoteImageRepository } from "./quote-image.repository";
import { AppError } from "../../utils/error-handler";
import { assertQuoteReadable, assertQuoteWritable } from "./quote-access";
import type { ScopeOrTrusted } from "../../utils/scope-conditions";
import {
  uploadImageToS3,
  deleteImageByStoredUrl,
  isAcceptableImageUrl,
  buildImageKey,
  buildImageProxyUrl,
  getPresignedPutUrl,
} from "../../utils/image-storage";
import type { PresignQuoteImageInput, PresignQuoteImageResult } from "./quote-image.types";

const QUOTE_IMAGE_KEY_PREFIX = "quote-images";

export const quoteImageService = {
  /** Upload image files to S3 and persist their proxy URLs against the quote. */
  async uploadFiles(quoteId: string, files: Express.Multer.File[], scope: ScopeOrTrusted) {
    if (!files || files.length === 0) {
      throw new AppError("No images provided", 400);
    }
    await assertQuoteWritable(quoteId, scope);
    const urls = await Promise.all(files.map((file) => uploadImageToS3(file, "quote-images")));
    return quoteImageRepository.addImages(quoteId, urls);
  },

  /**
   * Presign direct-to-S3 PUTs for quote image uploads (Option A, single PUT —
   * same pattern as training-upload.service.ts). The server generates the S3
   * key for every file — the client never chooses it — so the fixed
   * "quote-images/" prefix and the resulting proxyUrl are always trustworthy.
   * This does not touch the DB; the caller still submits the returned
   * proxyUrls as part of a create/update quote payload.
   */
  async presignUploads(files: PresignQuoteImageInput[]): Promise<PresignQuoteImageResult[]> {
    return Promise.all(
      files.map(async ({ filename, contentType }) => {
        const key = buildImageKey(QUOTE_IMAGE_KEY_PREFIX, filename, contentType);
        const uploadUrl = await getPresignedPutUrl(key, contentType);
        return { uploadUrl, key, proxyUrl: buildImageProxyUrl(key) };
      }),
    );
  },

  async addImages(quoteId: string, imageUrls: string[], scope: ScopeOrTrusted) {
    if (!imageUrls || imageUrls.length === 0) {
      throw new AppError("No images provided", 400);
    }
    await assertQuoteWritable(quoteId, scope);

    // Inline images, the app's own uploads and proxy URLs (public image keys only) and plain http(s) URLs.
    const validUrls = imageUrls.filter((url) => isAcceptableImageUrl(url));

    if (validUrls.length === 0) {
      throw new AppError("No valid image URLs provided", 400);
    }

    const images = await quoteImageRepository.addImages(quoteId, validUrls);

    return images;
  },

  async getQuoteImages(quoteId: string, scope: ScopeOrTrusted) {
    await assertQuoteReadable(quoteId, scope);
    const images = await quoteImageRepository.getByQuoteId(quoteId);
    return images;
  },

  /**
   * Delete an image from a quote. A shared accommodation / lodge library image shows in the quote's
   * gallery but is a master record used by every quote for that hotel: it is refused (400) rather than
   * deleted, because there is no per-quote way to hide it.
   */
  async deleteImage(quoteId: string, imageId: string, scope: ScopeOrTrusted) {
    await assertQuoteWritable(quoteId, scope);
    const outcome = await quoteImageService.removeOwnedImage(quoteId, imageId);
    if (outcome === "shared") {
      throw new AppError("This image belongs to the shared hotel gallery and cannot be removed from a single quote", 400);
    }
  },

  /**
   * Remove an image the quote itself owns (and its S3 object once nothing else references the URL).
   * Scope is the caller's job. Returns "shared" without touching anything for a library image.
   */
  async removeOwnedImage(quoteId: string, imageId: string): Promise<"removed" | "shared"> {
    const url = await quoteImageRepository.getImageUrl(quoteId, imageId);
    if (url === null && (await quoteImageRepository.isSharedGalleryImage(imageId))) return "shared";
    await quoteImageRepository.deleteImage(quoteId, imageId);
    // Only remove the backing S3 object once no row anywhere (quote_images,
    // accommodation_images, lodge_images, deal_images) still references this
    // exact URL — those tables are shared inventory across other quotes/deals.
    // Best-effort: no-op for legacy/base64 urls and for any key outside the public
    // image prefixes (s3KeyFromStoredUrl), and swallow S3 errors.
    if (url) {
      const stillReferenced = await quoteImageRepository.isUrlReferenced(url).catch(() => true);
      if (!stillReferenced) {
        await deleteImageByStoredUrl(url).catch(() => {});
      }
    }
    return "removed";
  },

  /** Swap an image URL on the quote; resolves to the number of rows changed. */
  async replaceImageUrl(quoteId: string, fromUrl: string, toUrl: string): Promise<number> {
    return quoteImageRepository.replaceImageUrl(quoteId, fromUrl, toUrl);
  },

  async setPrimaryImage(quoteId: string, imageId: string, scope: ScopeOrTrusted) {
    await assertQuoteWritable(quoteId, scope);
    const image = await quoteImageRepository.setPrimaryImage(quoteId, imageId);

    if (!image) {
      throw new AppError("Image not found", 404);
    }

    return image;
  },

  // `imageIds` is the full desired order. Ids the quote doesn't own are ignored
  // rather than rejected: the gallery merges in shared accommodation/lodge
  // library images, which have no per-quote row and so can't be reordered.
  // Accepts ids OR urls. The edit form arranges images before the new ones
  // exist as rows, so it can only identify them by URL; the Arrange dialog
  // works on saved rows and uses ids.
  async reorderImages(quoteId: string, order: { imageIds?: string[]; imageUrls?: string[] }, scope: ScopeOrTrusted) {
    await assertQuoteWritable(quoteId, scope);
    if (order.imageUrls?.length) await quoteImageRepository.reorderByUrl(quoteId, order.imageUrls);
    else if (order.imageIds?.length) await quoteImageRepository.reorder(quoteId, order.imageIds);
    return quoteImageRepository.getByQuoteId(quoteId);
  },
};
