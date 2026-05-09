import { cottageSettingsRepository } from './cottage.repository';
import { AppError } from '../../../utils/error-handler';

export const cottageSettingsService = {
  async findAll(query: Record<string, any>) {
    return cottageSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await cottageSettingsRepository.findById(id);
    if (!row) throw new AppError('Cottage not found', 404);
    return row;
  },

  async create(data: any) {
    return cottageSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await cottageSettingsRepository.update(id, data);
    if (!row) throw new AppError('Cottage not found', 404);
    return row;
  },

  async remove(id: string) {
    await cottageSettingsRepository.remove(id);
  },
};
