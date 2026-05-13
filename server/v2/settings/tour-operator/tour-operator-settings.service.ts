import { tourOperatorSettingsRepository } from './tour-operator-settings.repository';
import { AppError } from '../../../utils/error-handler';
import type { Scope } from '../../utils/scope';

export const tourOperatorSettingsService = {
  async findAll(query: Record<string, any>, scope: Scope) {
    return tourOperatorSettingsRepository.findAll(query, scope);
  },

  async findById(id: string, scope: Scope) {
    const row = await tourOperatorSettingsRepository.findById(id, scope);
    if (!row) throw new AppError('Tour operator not found', 404);
    return row;
  },

  async create(data: any, scope: Scope) {
    return tourOperatorSettingsRepository.create(data, scope);
  },

  async update(id: string, data: any, scope: Scope) {
    const row = await tourOperatorSettingsRepository.update(id, data, scope);
    if (!row) throw new AppError('Tour operator not found', 404);
    return row;
  },

  async remove(id: string, scope: Scope) {
    await tourOperatorSettingsRepository.remove(id, scope);
  },
};
