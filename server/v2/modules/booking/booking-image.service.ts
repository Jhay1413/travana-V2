import { bookingImageRepository } from "./booking-image.repository";
import { AppError } from "../../utils/error-handler";

export const bookingImageService = {
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
    await bookingImageRepository.deleteImage(bookingId, imageId);
  },

  async setPrimaryImage(bookingId: string, imageId: string) {
    const image = await bookingImageRepository.setPrimaryImage(bookingId, imageId);

    if (!image) {
      throw new AppError("Image not found", 404);
    }

    return image;
  },
};
