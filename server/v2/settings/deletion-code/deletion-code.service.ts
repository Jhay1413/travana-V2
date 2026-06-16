import { deletionCodeSettingsRepository } from './deletion-code.repository';
import { AppError } from '../../../utils/error-handler';

export const deletionCodeSettingsService = {
  async findAll(query: Record<string, unknown>) {
    return deletionCodeSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await deletionCodeSettingsRepository.findById(id);
    if (!row) throw new AppError('Deletion code not found', 404);
    return row;
  },

  async create(data: unknown) {
    return deletionCodeSettingsRepository.create(data);
  },

  async update(id: string, data: unknown) {
    const row = await deletionCodeSettingsRepository.update(id, data);
    if (!row) throw new AppError('Deletion code not found', 404);
    return row;
  },

  async remove(id: string) {
    await deletionCodeSettingsRepository.remove(id);
  },
};
