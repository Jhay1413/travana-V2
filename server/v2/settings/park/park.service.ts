import { parkSettingsRepository } from './park.repository';
import { AppError } from '../../../utils/error-handler';

export const parkSettingsService = {
  async findAll(query: Record<string, any>) {
    return parkSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await parkSettingsRepository.findById(id);
    if (!row) throw new AppError('Park not found', 404);
    return row;
  },

  async create(data: any) {
    return parkSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await parkSettingsRepository.update(id, data);
    if (!row) throw new AppError('Park not found', 404);
    return row;
  },

  async remove(id: string) {
    await parkSettingsRepository.remove(id);
  },
};
