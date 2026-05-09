import { accommodationSettingsRepository } from './accommodation.repository';
import { AppError } from '../../../utils/error-handler';

export const accommodationSettingsService = {
  async findAll(query: Record<string, any>) {
    return accommodationSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await accommodationSettingsRepository.findById(id);
    if (!row) throw new AppError('Accommodation not found', 404);
    return row;
  },

  async create(data: any) {
    return accommodationSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await accommodationSettingsRepository.update(id, data);
    if (!row) throw new AppError('Accommodation not found', 404);
    return row;
  },

  async remove(id: string) {
    await accommodationSettingsRepository.remove(id);
  },
};
