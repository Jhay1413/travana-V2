import { quotePublicRepository } from '../quote/quote-public.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';

export const quoteShareService = {
  async generateToken(quoteId: string) {
    return quotePublicRepository.setToken(quoteId);
  },

  async getViewStats(quoteId: string) {
    return quotePublicRepository.getViewStats(quoteId);
  },

  /** Platform admins see across orgs; everyone else only their own org's clients. */
  async getClientQuoteViews(clientId: string, scope: Scope) {
    const orgId = scope.orgRole === 'platform_admin' ? null : scope.orgId || null;
    return quotePublicRepository.getClientQuoteViews(clientId, orgId);
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
    const allowed = new Set(['admin', 'manager', 'agent', 'homeworker']);
    if (agentId !== userId && !allowed.has(userRole)) {
      throw new AppError('Access denied', 403);
    }
  },
};
