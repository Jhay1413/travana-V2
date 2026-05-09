import { lodgeSettingsRepository } from './lodge.repository';
import { AppError } from '../../../utils/error-handler';

export const lodgeSettingsService = {
  async findAll(query: Record<string, any>) {
    return lodgeSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await lodgeSettingsRepository.findById(id);
    if (!row) throw new AppError('Lodge not found', 404);
    return row;
  },

  async create(data: any) {
    return lodgeSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await lodgeSettingsRepository.update(id, data);
    if (!row) throw new AppError('Lodge not found', 404);
    return row;
  },

  async remove(id: string) {
    await lodgeSettingsRepository.remove(id);
  },
};
