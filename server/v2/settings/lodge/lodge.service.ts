import { lodgeSettingsRepository } from './lodge.repository';
import { AppError } from '../../../utils/error-handler';

// The settings page submits an empty string when no park is chosen; park_id is a
// uuid column, so store that as null instead of letting Postgres reject it.
function normalizeParkId<T extends { park_id?: unknown }>(data: T): T {
  return data.park_id === '' ? { ...data, park_id: null } : data;
}

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
    return lodgeSettingsRepository.create(normalizeParkId(data));
  },

  async update(id: string, data: any) {
    const row = await lodgeSettingsRepository.update(id, normalizeParkId(data));
    if (!row) throw new AppError('Lodge not found', 404);
    return row;
  },

  async remove(id: string) {
    await lodgeSettingsRepository.remove(id);
  },
};
