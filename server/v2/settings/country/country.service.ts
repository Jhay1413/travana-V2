import { countrySettingsRepository } from './country.repository';
import { AppError } from '../../../utils/error-handler';

export const countrySettingsService = {
  async findAll(query: Record<string, unknown>) {
    return countrySettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await countrySettingsRepository.findById(id);
    if (!row) throw new AppError('Country not found', 404);
    return row;
  },

  async create(data: unknown) {
    return countrySettingsRepository.create(data);
  },

  async update(id: string, data: unknown) {
    const row = await countrySettingsRepository.update(id, data);
    if (!row) throw new AppError('Country not found', 404);
    return row;
  },

  async remove(id: string) {
    await countrySettingsRepository.remove(id);
  },
};
