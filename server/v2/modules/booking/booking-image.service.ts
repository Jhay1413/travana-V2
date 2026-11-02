import { bookingImageRepository } from "./booking-image.repository";
import { AppError } from "../../utils/error-handler";
import { uploadImageToS3, deleteImageByStoredUrl, isAcceptableImageUrl } from "../../utils/image-storage";
import { quoteImageRepository } from "../quote/quote-image.repository";
import { assertBookingReadable, assertBookingWritable } from "./booking-access";
import type { Scope } from "../../utils/scope";

type ScopeOrTrusted = Scope | { orgId: null };

export const bookingImageService = {
  /** Upload image files to S3 and persist their proxy URLs against the booking. */
  async uploadFiles(bookingId: string, files: Express.Multer.File[], scope: ScopeOrTrusted) {
    if (!files || files.length === 0) {
      throw new AppError("No images provided", 400);
    }
    await assertBookingWritable(bookingId, scope);
    const urls = await Promise.all(files.map((file) => uploadImageToS3(file, "booking-images")));
    return bookingImageRepository.addImages(bookingId, urls);
  },

  async addImages(bookingId: string, imageUrls: string[], scope: ScopeOrTrusted) {
    if (!imageUrls || imageUrls.length === 0) {
      throw new AppError("No images provided", 400);
    }
    await assertBookingWritable(bookingId, scope);

    // Inline images, the app's own uploads and proxy URLs (public image keys only) and plain http(s) URLs.
    const validUrls = imageUrls.filter((url) => isAcceptableImageUrl(url));

    if (validUrls.length === 0) {
      throw new AppError("No valid image URLs provided", 400);
    }

    const images = await bookingImageRepository.addImages(bookingId, validUrls);

    return images;
  },

  async getBookingImages(bookingId: string, scope: ScopeOrTrusted) {
    await assertBookingReadable(bookingId, scope);
    const images = await bookingImageRepository.getByBookingId(bookingId);
    return images;
  },

  /**
   * Delete an image from a booking. A shared accommodation / lodge library image is a master record used by
   * every booking and quote for that hotel: it is refused (400), never deleted.
   */
  async deleteImage(bookingId: string, imageId: string, scope: ScopeOrTrusted) {
    await assertBookingWritable(bookingId, scope);
    const url = await bookingImageRepository.getImageUrl(bookingId, imageId);
    if (url === null && (await quoteImageRepository.isSharedGalleryImage(imageId))) {
      throw new AppError("This image belongs to the shared hotel gallery and cannot be removed from a single booking", 400);
    }
    await bookingImageRepository.deleteImage(bookingId, imageId);
    // A converted quote shares its image URLs with the booking, so the S3 object is only removed once no row
    // anywhere (booking_images, quote_images, accommodation_images, lodge_images, deal_images) still points at it.
    // Best-effort: no-op for legacy/base64 urls and for any key outside the public image prefixes.
    if (url) {
      const stillReferenced =
        (await bookingImageRepository.isUrlReferencedByBooking(url).catch(() => true)) ||
        (await quoteImageRepository.isUrlReferenced(url).catch(() => true));
      if (!stillReferenced) await deleteImageByStoredUrl(url).catch(() => {});
    }
  },

  async setPrimaryImage(bookingId: string, imageId: string, scope: ScopeOrTrusted) {
    await assertBookingWritable(bookingId, scope);
    const image = await bookingImageRepository.setPrimaryImage(bookingId, imageId);

    if (!image) {
      throw new AppError("Image not found", 404);
    }

    return image;
  },

  // `imageIds` is the full desired order — see quoteImageService.reorderImages.
  // Accepts ids OR urls. The edit form arranges images before the new ones
  // exist as rows, so it can only identify them by URL; the Arrange dialog
  // works on saved rows and uses ids.
  async reorderImages(bookingId: string, order: { imageIds?: string[]; imageUrls?: string[] }, scope: ScopeOrTrusted) {
    await assertBookingWritable(bookingId, scope);
    if (order.imageUrls?.length) await bookingImageRepository.reorderByUrl(bookingId, order.imageUrls);
    else if (order.imageIds?.length) await bookingImageRepository.reorder(bookingId, order.imageIds);
    return bookingImageRepository.getByBookingId(bookingId);
  },
};
