import { quotePublicRepository } from '../quote/quote-public.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';

const ACCESS_ROLES: ReadonlySet<string> = new Set(['platform_admin', 'org_admin', 'branch_manager', 'agent', 'homeworker']);

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

  /**
   * Every quote-share endpoint on a single quote goes through this. The quote must belong to
   * the caller's org (404 otherwise, so other orgs' quote ids are not confirmable); platform
   * admins are exempt. Inside the org the owner, or a role that works deals, may proceed.
   */
  async verifyAccess(quoteId: string, userId: string, scope: Scope) {
    const owner = await quotePublicRepository.getOwnerByQuoteId(quoteId);
    if (!owner) throw new AppError('Quote not found', 404);
    const isPlatformAdmin = scope.orgRoles.includes('platform_admin');
    if (!isPlatformAdmin && (!scope.orgId || owner.orgId !== scope.orgId)) {
      throw new AppError('Quote not found', 404);
    }
    if (owner.userId !== userId && !scope.orgRoles.some((r) => ACCESS_ROLES.has(r))) {
      throw new AppError('Access denied', 403);
    }
  },
};
