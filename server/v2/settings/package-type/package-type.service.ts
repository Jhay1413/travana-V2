import { packageTypeSettingsRepository } from './package-type.repository';
import { AppError } from '../../../utils/error-handler';

export const packageTypeSettingsService = {
  async findAll(query: Record<string, unknown>) {
    return packageTypeSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await packageTypeSettingsRepository.findById(id);
    if (!row) throw new AppError('Package type not found', 404);
    return row;
  },

  async create(data: unknown) {
    return packageTypeSettingsRepository.create(data);
  },

  async update(id: string, data: unknown) {
    const row = await packageTypeSettingsRepository.update(id, data);
    if (!row) throw new AppError('Package type not found', 404);
    return row;
  },

  async remove(id: string) {
    await packageTypeSettingsRepository.remove(id);
  },
};
