import { airportRepository } from './airport.repository';
import { AppError } from '../../utils/error-handler';
import type { InsertAirport } from '@shared/schema';

export const airportService = {
  async listAirports(opts?: { countryIds?: string[] }) {
    return airportRepository.findAll(opts);
  },

  async createAirport(data: InsertAirport) {
    return airportRepository.create(data);
  },

  async deleteAirport(id: string) {
    const existing = await airportRepository.findById(id);
    if (!existing) throw new AppError('Airport not found', 404);
    await airportRepository.remove(id);
  },
};
