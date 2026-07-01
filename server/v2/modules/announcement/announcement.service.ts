import { announcementRepository } from './announcement.repository';
import { AppError } from '../../utils/error-handler';

export const announcementService = {
  async findAll(category?: string) {
    return announcementRepository.findAll(category);
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

  async hide(announcementId: string, userId: string) {
    const row = await announcementRepository.findById(announcementId);
    if (!row) throw new AppError('Announcement not found', 404);
    await announcementRepository.hide(announcementId, userId);
  },

  async findHiddenIds(userId: string) {
    return announcementRepository.findHiddenIdsByUser(userId);
  },
};
