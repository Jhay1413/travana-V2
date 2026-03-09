import { quoteImageRepository } from "../repositories/quote-image.repository";
import { AppError } from "../utils/error-handler";

export const quoteImageService = {
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

    console.log(`📸 Adding ${validUrls.length} images to quote ${quoteId}`);
    
    const images = await quoteImageRepository.addImages(quoteId, validUrls);
    
    return images;
  },

  async getQuoteImages(quoteId: string) {
    const images = await quoteImageRepository.getByQuoteId(quoteId);
    return images;
  },

  async deleteImage(quoteId: string, imageId: string) {
    await quoteImageRepository.deleteImage(quoteId, imageId);
  },

  async setPrimaryImage(quoteId: string, imageId: string) {
    const image = await quoteImageRepository.setPrimaryImage(quoteId, imageId);
    
    if (!image) {
      throw new AppError("Image not found", 404);
    }

    return image;
  },
};
