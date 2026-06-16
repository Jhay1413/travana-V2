import { cruiseVoyageSettingsRepository } from './cruise-voyage.repository';
import { AppError } from '../../../utils/error-handler';

export const cruiseVoyageSettingsService = {
  async findAll(query: Record<string, unknown>) {
    return cruiseVoyageSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await cruiseVoyageSettingsRepository.findById(id);
    if (!row) throw new AppError('Cruise voyage not found', 404);
    return row;
  },

  async create(data: Record<string, unknown>) {
    return cruiseVoyageSettingsRepository.create(data);
  },

  async update(id: string, data: Record<string, unknown>) {
    const row = await cruiseVoyageSettingsRepository.update(id, data);
    if (!row) throw new AppError('Cruise voyage not found', 404);
    return row;
  },

  async remove(id: string) {
    await cruiseVoyageSettingsRepository.remove(id);
  },
};
