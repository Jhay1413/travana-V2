import { airportRepository } from './airport.repository';
import { AppError } from '../../utils/error-handler';

export const airportService = {
  async listAirports() {
    return airportRepository.findAll();
  },

  async createAirport(data: any) {
    return airportRepository.create(data);
  },

  async deleteAirport(id: string) {
    const existing = await airportRepository.findById(id);
    if (!existing) throw new AppError('Airport not found', 404);
    await airportRepository.remove(id);
  },
};
