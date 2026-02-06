import { accommodationRepository } from "../repositories/accommodation.repository";
import { AppError } from "../utils/error-handler";
import type { Accommodation, InsertAccommodation } from "../types/accommodation";

export const accommodationService = {
  async getByQuoteId(quoteId: string): Promise<Accommodation> {
    const accommodation = await accommodationRepository.findByQuoteId(quoteId);
    if (!accommodation) {
      throw new AppError("Accommodation not found", 404);
    }
    return accommodation;
  },

  async createAccommodation(data: InsertAccommodation): Promise<Accommodation> {
    const accommodation = await accommodationRepository.create(data);
    return accommodation;
  },

  async updateAccommodation(id: string, data: Partial<InsertAccommodation>): Promise<Accommodation> {
    const accommodation = await accommodationRepository.update(id, data);
    if (!accommodation) {
      throw new AppError("Accommodation not found", 404);
    }
    return accommodation;
  },
};
