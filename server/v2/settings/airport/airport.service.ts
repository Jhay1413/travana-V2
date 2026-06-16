import { airportSettingsRepository } from './airport.repository';
import { AppError } from '../../../utils/error-handler';

export const airportSettingsService = {
  async findAll(query: Record<string, any>) {
    return airportSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await airportSettingsRepository.findById(id);
    if (!row) throw new AppError('Airport not found', 404);
    return row;
  },

  async create(data: any) {
    return airportSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await airportSettingsRepository.update(id, data);
    if (!row) throw new AppError('Airport not found', 404);
    return row;
  },

  async remove(id: string) {
    await airportSettingsRepository.remove(id);
  },
};
