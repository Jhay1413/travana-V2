import { feedbackRepository } from './feedback.repository';
import { AppError } from '../../utils/error-handler';

export const feedbackService = {
  async findAll() {
    return feedbackRepository.findAll();
  },

  async findByUserId(userId: string) {
    return feedbackRepository.findByUserId(userId);
  },

  async create(data: any) {
    return feedbackRepository.create(data);
  },

  async updateStatus(id: string, status: string, adminNotes?: string) {
    const row = await feedbackRepository.updateStatus(id, status, adminNotes);
    if (!row) throw new AppError('Feedback not found', 404);
    return row;
  },

  async remove(id: string) {
    await feedbackRepository.remove(id);
  },
};
