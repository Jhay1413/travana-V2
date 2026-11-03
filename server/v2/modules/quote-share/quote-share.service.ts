import { quotePublicRepository } from '../quote/quote-public.repository';
import { quoteShareRepository } from './quote-share.repository';
import type { QuoteSentVia } from './quote-share.validator';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';
import { assertQuoteReadable, assertQuoteWritable } from '../quote/quote-access';

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

  /** Platform admins see across orgs; everyone else only the deals their scope pins them to (see the repository). */
  async getClientQuoteViews(clientId: string, scope: Scope) {
    return quotePublicRepository.getClientQuoteViews(clientId, scope);
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
   * admins are exempt. Then the deal scope applies: writes (generate-token, send-whatsapp, mark sent) use the
   * shop-pinned write scope (403 "another shop" when readable but not theirs, 404 for a no-shop agent, a
   * homeworker's deal or another agency); reads (views, customer-actions) use the record scope.
   * Inside that, the owner, or a role that works deals, may proceed (reads additionally allow read-only roles).
   */
  async verifyAccess(quoteId: string, userId: string, scope: Scope, mode: 'read' | 'write' = 'write') {
    const owner = await quotePublicRepository.getOwnerByQuoteId(quoteId);
    if (!owner) throw new AppError('Quote not found', 404);
    const isPlatformAdmin = scope.orgRoles.includes('platform_admin');
    if (!isPlatformAdmin && (!scope.orgId || owner.orgId !== scope.orgId)) {
      throw new AppError('Quote not found', 404);
    }
    if (mode === 'read') await assertQuoteReadable(quoteId, scope);
    else await assertQuoteWritable(quoteId, scope);
    const allowed = mode === 'read' ? READ_ACCESS_ROLES : ACCESS_ROLES;
    if (owner.userId !== userId && !scope.orgRoles.some((r) => allowed.has(r))) {
      throw new AppError('Access denied', 403);
    }
  },
};
