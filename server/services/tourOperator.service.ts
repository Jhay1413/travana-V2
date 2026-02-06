import { tourOperatorRepository } from "../repositories/tourOperator.repository";
import { AppError } from "../utils/error-handler";
import type { TourOperator, InsertTourOperator } from "../types/tourOperator";

export const tourOperatorService = {
  async listTourOperators(): Promise<TourOperator[]> {
    return await tourOperatorRepository.findAll();
  },

  async getTourOperatorById(id: string): Promise<TourOperator> {
    const tourOperator = await tourOperatorRepository.findById(id);
    if (!tourOperator) {
      throw new AppError("Tour operator not found", 404);
    }
    return tourOperator;
  },

  async createTourOperator(data: InsertTourOperator): Promise<TourOperator> {
    const tourOperator = await tourOperatorRepository.create(data);
    return tourOperator;
  },

  async updateTourOperator(id: string, data: Partial<InsertTourOperator>): Promise<TourOperator> {
    const tourOperator = await tourOperatorRepository.update(id, data);
    if (!tourOperator) {
      throw new AppError("Tour operator not found", 404);
    }
    return tourOperator;
  },

  async deleteTourOperator(id: string): Promise<void> {
    await tourOperatorRepository.remove(id);
  },
};
