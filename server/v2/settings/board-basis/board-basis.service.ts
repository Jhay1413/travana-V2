import { boardBasisSettingsRepository } from './board-basis.repository';
import { AppError } from '../../../utils/error-handler';

export const boardBasisSettingsService = {
  async findAll(query: Record<string, any>) {
    return boardBasisSettingsRepository.findAll(query);
  },

  async findById(id: string) {
    const row = await boardBasisSettingsRepository.findById(id);
    if (!row) throw new AppError('Board basis not found', 404);
    return row;
  },

  async create(data: any) {
    return boardBasisSettingsRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await boardBasisSettingsRepository.update(id, data);
    if (!row) throw new AppError('Board basis not found', 404);
    return row;
  },

  async remove(id: string) {
    await boardBasisSettingsRepository.remove(id);
  },
};
