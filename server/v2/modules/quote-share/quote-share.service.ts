import { quotePublicRepository } from '../quote/quote-public.repository';
import { AppError } from '../../utils/error-handler';

export const quoteShareService = {
  async generateToken(quoteId: string) {
    return quotePublicRepository.setToken(quoteId);
  },

  async getViewStats(quoteId: string) {
    return quotePublicRepository.getViewStats(quoteId);
  },

  async getCustomerActions(quoteId: string) {
    return quotePublicRepository.getCustomerActions(quoteId);
  },

  async updateSentInfo(quoteId: string, sentVia: string) {
    return quotePublicRepository.updateSentInfo(quoteId, sentVia || 'link');
  },

  async verifyAccess(quoteId: string, userId: string, userRole: string) {
    const agentId = await quotePublicRepository.getAgentUserIdByQuoteId(quoteId);
    if (!agentId) throw new AppError('Quote not found', 404);
    if (agentId !== userId && userRole !== 'admin' && userRole !== 'manager') {
      throw new AppError('Access denied', 403);
    }
  },
};
