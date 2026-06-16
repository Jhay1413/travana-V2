import { cruiseExtraSettingsRepository } from './cruise-extra.repository';
import { AppError } from '../../../utils/error-handler';

export const cruiseExtraSettingsService = {
  async findAll(query: Record<string, unknown>) {
    return cruiseExtraSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await cruiseExtraSettingsRepository.findById(id);
    if (!row) throw new AppError('Cruise extra not found', 404);
    return row;
  },

  async create(data: unknown) {
    return cruiseExtraSettingsRepository.create(data);
  },

  async update(id: string, data: unknown) {
    const row = await cruiseExtraSettingsRepository.update(id, data);
    if (!row) throw new AppError('Cruise extra not found', 404);
    return row;
  },

  async remove(id: string) {
    await cruiseExtraSettingsRepository.remove(id);
  },
};
