import { roomTypeSettingsRepository } from './room-type.repository';
import { AppError } from '../../../utils/error-handler';

export const roomTypeSettingsService = {
  async findAll(query: Record<string, any>) {
    return roomTypeSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await roomTypeSettingsRepository.findById(id);
    if (!row) throw new AppError('Room type not found', 404);
    return row;
  },

  async create(data: any) {
    return roomTypeSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await roomTypeSettingsRepository.update(id, data);
    if (!row) throw new AppError('Room type not found', 404);
    return row;
  },

  async remove(id: string) {
    await roomTypeSettingsRepository.remove(id);
  },
};
