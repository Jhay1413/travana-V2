import { quoteImageRepository } from "../repositories/quoteImage.repository";
import type { QuoteImage, InsertQuoteImage } from "../types/quoteImage";

export const quoteImageService = {
  async listByQuoteId(quoteId: string): Promise<QuoteImage[]> {
    return await quoteImageRepository.findByQuoteId(quoteId);
  },

  async createQuoteImage(data: InsertQuoteImage): Promise<QuoteImage> {
    const image = await quoteImageRepository.create(data);
    return image;
  },

  async deleteQuoteImage(id: string): Promise<void> {
    await quoteImageRepository.remove(id);
  },
};
