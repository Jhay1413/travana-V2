import { announcementRepository } from './announcement.repository';
import { AppError } from '../../utils/error-handler';

export const announcementService = {
  async findAll() {
    return announcementRepository.findAll();
  },

  async findById(id: string) {
    const row = await announcementRepository.findById(id);
    if (!row) throw new AppError('Announcement not found', 404);
    return row;
  },

  async create(data: any) {
    return announcementRepository.create(data);
  },

  async update(id: string, data: any) {
    const row = await announcementRepository.update(id, data);
    if (!row) throw new AppError('Announcement not found', 404);
    return row;
  },

  async togglePin(id: string) {
    const row = await announcementRepository.togglePin(id);
    if (!row) throw new AppError('Announcement not found', 404);
    return row;
  },

  async remove(id: string) {
    await announcementRepository.remove(id);
  },
};
