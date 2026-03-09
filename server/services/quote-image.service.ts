import { quoteImageRepository } from "../repositories/quote-image.repository";
import { AppError } from "../utils/error-handler";
import path from "path";
import fs from "fs/promises";

export const quoteImageService = {
  /**
   * Add images to a quote
   */
  async addImages(quoteId: string, imageUrls: string[]) {
    if (!imageUrls || imageUrls.length === 0) {
      throw new AppError("No images provided", 400);
    }

    const validUrls = imageUrls.filter(url => {
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

    console.log(`📸 Adding ${validUrls.length} images to quote ${quoteId}`);
    
    const images = await quoteImageRepository.addImages(quoteId, validUrls);
    
    return images;
  },

  /**
   * Get all images for a quote
   */
  async getQuoteImages(quoteId: string) {
    const images = await quoteImageRepository.getByQuoteId(quoteId);
    return images;
  },

  /**
   * Delete an image from a quote
   */
  async deleteImage(quoteId: string, imageId: string) {
    const images = await quoteImageRepository.getByQuoteId(quoteId);
    const imageToDelete = images.find(img => img.id === imageId);

    await quoteImageRepository.deleteImage(quoteId, imageId);

    if (imageToDelete?.url?.startsWith("/uploads/")) {
      const filepath = path.join(process.cwd(), "public", imageToDelete.url);
      await fs.unlink(filepath).catch(() => {});
    }
  },

  /**
   * Set an image as primary
   */
  async setPrimaryImage(quoteId: string, imageId: string) {
    const image = await quoteImageRepository.setPrimaryImage(quoteId, imageId);
    
    if (!image) {
      throw new AppError("Image not found", 404);
    }

    return image;
  },
};
