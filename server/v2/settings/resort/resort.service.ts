import { resortSettingsRepository } from './resort.repository';
import { AppError } from '../../utils/error-handler';

export const resortSettingsService = {
  async list(query: Record<string, any>) { return resortSettingsRepository.findAll(query); },
  async getById(id: string) {
    const row = await resortSettingsRepository.findById(id);
    if (!row) throw new AppError('Resort not found', 404);
    return row;
  },
  async create(data: any) { return resortSettingsRepository.create(data); },
  async update(id: string, data: any) {
    const row = await resortSettingsRepository.update(id, data);
    if (!row) throw new AppError('Resort not found', 404);
    return row;
  },
  async remove(id: string) { await resortSettingsRepository.remove(id); },
};
