import { destinationSettingsRepository } from './destination.repository';
import { AppError } from '../../utils/error-handler';

export const destinationSettingsService = {
  async list(query: Record<string, any>) {
    return destinationSettingsRepository.findAll(query);
  },

  async getById(id: string) {
    const row = await destinationSettingsRepository.findById(id);
    if (!row) throw new AppError('Destination not found', 404);
    return row;
  },

  async create(data: any) {
    return destinationSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await destinationSettingsRepository.update(id, data);
    if (!row) throw new AppError('Destination not found', 404);
    return row;
  },

  async remove(id: string) {
    await destinationSettingsRepository.remove(id);
  },
};
