import { accommodationTypeSettingsRepository } from './accommodation-type.repository';
import { AppError } from '../../../utils/error-handler';

export const accommodationTypeSettingsService = {
  async findAll(query: Record<string, any>) {
    return accommodationTypeSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await accommodationTypeSettingsRepository.findById(id);
    if (!row) throw new AppError('Accommodation type not found', 404);
    return row;
  },

  async create(data: any) {
    return accommodationTypeSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await accommodationTypeSettingsRepository.update(id, data);
    if (!row) throw new AppError('Accommodation type not found', 404);
    return row;
  },

  async remove(id: string) {
    await accommodationTypeSettingsRepository.remove(id);
  },
};
