import { tagSettingsRepository } from './tag.repository';
import { AppError } from '../../../utils/error-handler';

export const tagSettingsService = {
  async findAll(query: Record<string, unknown>) {
    return tagSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await tagSettingsRepository.findById(id);
    if (!row) throw new AppError('Tag not found', 404);
    return row;
  },

  async create(data: unknown) {
    return tagSettingsRepository.create(data);
  },

  async update(id: string, data: unknown) {
    const row = await tagSettingsRepository.update(id, data);
    if (!row) throw new AppError('Tag not found', 404);
    return row;
  },

  async remove(id: string) {
    await tagSettingsRepository.remove(id);
  },
};
