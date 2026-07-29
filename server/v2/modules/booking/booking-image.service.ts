import { bookingImageRepository } from "./booking-image.repository";
import { AppError } from "../../utils/error-handler";
import { uploadImageToS3, deleteImageByStoredUrl } from "../../utils/image-storage";

export const bookingImageService = {
  /** Upload image files to S3 and persist their proxy URLs against the booking. */
  async uploadFiles(bookingId: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new AppError("No images provided", 400);
    }
    const urls = await Promise.all(files.map((file) => uploadImageToS3(file, "booking-images")));
    return bookingImageRepository.addImages(bookingId, urls);
  },

  async addImages(bookingId: string, imageUrls: string[]) {
    if (!imageUrls || imageUrls.length === 0) {
      throw new AppError("No images provided", 400);
    }

    const validUrls = imageUrls.filter(url => {
      if (url.startsWith('data:image/')) return true;
      if (url.startsWith('/uploads/') || url.startsWith('/avatars/')) return true;
      try {
        new URL(url);
        return url.startsWith('http://') || url.startsWith('https://');
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) {
      throw new AppError("No valid image URLs provided", 400);
    }

    const images = await bookingImageRepository.addImages(bookingId, validUrls);

    return images;
  },

  async getBookingImages(bookingId: string) {
    const images = await bookingImageRepository.getByBookingId(bookingId);
    return images;
  },

  async deleteImage(bookingId: string, imageId: string) {
    const url = await bookingImageRepository.getImageUrl(bookingId, imageId);
    await bookingImageRepository.deleteImage(bookingId, imageId);
    // Best-effort: remove the backing S3 object (no-op for legacy/base64 urls).
    await deleteImageByStoredUrl(url).catch(() => {});
  },

  async setPrimaryImage(bookingId: string, imageId: string) {
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
  async reorderImages(bookingId: string, order: { imageIds?: string[]; imageUrls?: string[] }) {
    if (order.imageUrls?.length) await bookingImageRepository.reorderByUrl(bookingId, order.imageUrls);
    else if (order.imageIds?.length) await bookingImageRepository.reorder(bookingId, order.imageIds);
    return bookingImageRepository.getByBookingId(bookingId);
  },
};
