import { quotePublicRepository } from '../quote/quote-public.repository';
import { quoteShareRepository } from './quote-share.repository';
import type { QuoteSentVia } from './quote-share.validator';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';

const ACCESS_ROLES: ReadonlySet<string> = new Set(['platform_admin', 'org_admin', 'branch_manager', 'agent', 'homeworker']);
// social_media_manager is read-only on all client data: it may read views / customer actions
// on any in-org deal, but generate-token and mark-sent stay owner-only for it.
const READ_ACCESS_ROLES: ReadonlySet<string> = new Set([...ACCESS_ROLES, 'social_media_manager']);

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

  /** Stamps quote_sent_via; the first-sent date is kept by the repository. */
  async updateSentInfo(quoteId: string, sentVia: QuoteSentVia) {
    return quoteShareRepository.updateSentInfo(quoteId, sentVia);
  },

  /**
   * Every quote-share endpoint on a single quote goes through this. The quote must belong to
   * the caller's org (404 otherwise, so other orgs' quote ids are not confirmable); platform
   * admins are exempt. Inside the org the owner, or a role that works deals, may proceed (reads additionally allow read-only roles).
   */
  async verifyAccess(quoteId: string, userId: string, scope: Scope, mode: 'read' | 'write' = 'write') {
    const owner = await quotePublicRepository.getOwnerByQuoteId(quoteId);
    if (!owner) throw new AppError('Quote not found', 404);
    const isPlatformAdmin = scope.orgRoles.includes('platform_admin');
    if (!isPlatformAdmin && (!scope.orgId || owner.orgId !== scope.orgId)) {
      throw new AppError('Quote not found', 404);
    }
    const allowed = mode === 'read' ? READ_ACCESS_ROLES : ACCESS_ROLES;
    if (owner.userId !== userId && !scope.orgRoles.some((r) => allowed.has(r))) {
      throw new AppError('Access denied', 403);
    }
  },
};
