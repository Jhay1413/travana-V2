import { quoteImageRepository } from "./quote-image.repository";
import { AppError } from "../../utils/error-handler";
import { uploadImageToS3, deleteImageByStoredUrl } from "../../utils/image-storage";

export const quoteImageService = {
  /** Upload image files to S3 and persist their proxy URLs against the quote. */
  async uploadFiles(quoteId: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new AppError("No images provided", 400);
    }
    const urls = await Promise.all(files.map((file) => uploadImageToS3(file, "quote-images")));
    return quoteImageRepository.addImages(quoteId, urls);
  },

  async addImages(quoteId: string, imageUrls: string[]) {
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

    const images = await quoteImageRepository.addImages(quoteId, validUrls);

    return images;
  },

  async getQuoteImages(quoteId: string) {
    const images = await quoteImageRepository.getByQuoteId(quoteId);
    return images;
  },

  async deleteImage(quoteId: string, imageId: string) {
    const url = await quoteImageRepository.getImageUrl(quoteId, imageId);
    await quoteImageRepository.deleteImage(quoteId, imageId);
    // Best-effort: remove the backing S3 object (no-op for legacy/base64 urls).
    await deleteImageByStoredUrl(url).catch(() => {});
  },

  async setPrimaryImage(quoteId: string, imageId: string) {
    const image = await quoteImageRepository.setPrimaryImage(quoteId, imageId);

    if (!image) {
      throw new AppError("Image not found", 404);
    }

    return image;
  },
};
