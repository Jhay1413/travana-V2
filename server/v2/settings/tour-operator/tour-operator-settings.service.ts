import { tourOperatorSettingsRepository } from './tour-operator-settings.repository';
import { AppError } from '../../../utils/error-handler';

export const tourOperatorSettingsService = {
  async findAll(query: Record<string, any>) {
    return tourOperatorSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await tourOperatorSettingsRepository.findById(id);
    if (!row) throw new AppError('Tour operator not found', 404);
    return row;
  },

  async create(data: any) {
    return tourOperatorSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await tourOperatorSettingsRepository.update(id, data);
    if (!row) throw new AppError('Tour operator not found', 404);
    return row;
  },

  async remove(id: string) {
    await tourOperatorSettingsRepository.remove(id);
  },
};
