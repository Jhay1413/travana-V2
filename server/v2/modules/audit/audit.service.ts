import { auditRepository } from './audit.repository';
import { newQuoteRepository } from '../quote/quote.repository';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === 'platform_admin' ? null : (scope.orgId || null);
}

interface DeleteByAdmin {
  id: string;
  reason: string;
  performedBy: string;
  performedByName: string;
  /** Required only when `id` names the transaction's primary quote and it has
   *  other live (non-lost/archived, non-deleted) siblings — see deleteQuote. */
  newPrimaryQuoteId?: string;
}

// A quote promoted to primary here gets the same fresh 6-day expiry window
// newQuoteService.setPrimaryQuote grants on an explicit "set as main" action.
// Promoting a sibling during a delete is the same business event (a copy
// becomes the deal's primary quote) just triggered a different way, so it
// gets the same treatment — otherwise a copy that was already close to (or
// past) its own expiry would silently inherit primary status without a fresh
// quoted window.
const NEW_PRIMARY_EXPIRY_MS = 6 * 24 * 60 * 60 * 1000;

export const auditService = {
  async findAll(scope: Scope) {
    return auditRepository.findAll(effectiveOrgId(scope));
  },

  async createEntry(entry: any) {
    return auditRepository.create(entry);
  },

  async deleteQuote(scope: Scope, input: DeleteByAdmin) {
    const quoteData = await auditRepository.findActiveQuoteById(input.id);
    if (!quoteData) throw new AppError('Quote not found', 404);

    const { orgId, clientId, clientName } = await auditRepository.resolveEntityClient(quoteData.transaction_id ?? null);

    const callerOrgId = effectiveOrgId(scope);
    if (callerOrgId && orgId !== callerOrgId) {
      throw new AppError('Quote not found', 404);
    }

    // Deleting the transaction's primary quote must never leave it with zero
    // primaries. If live siblings exist, the caller must nominate one of them
    // to promote before the delete can proceed.
    if (quoteData.isQuoteCopy === false && quoteData.transaction_id) {
      const siblingCount = await newQuoteRepository.countActiveSiblings(quoteData.transaction_id, input.id);
      if (siblingCount > 0) {
        if (!input.newPrimaryQuoteId) {
          throw new AppError('NEW_PRIMARY_REQUIRED', 400);
        }

        // Mirrors the same predicate in newQuoteService.deleteQuote — keep them
        // in sync if either changes. findById already filters deleted_at at the
        // DB level, but the explicit check here makes the invariant visible at
        // the call site instead of relying on that filter implicitly.
        const candidate = await newQuoteRepository.findById(input.newPrimaryQuoteId);
        const isValidSibling = !!candidate
          && !candidate.deleted_at
          && candidate.transaction_id === quoteData.transaction_id
          && candidate.id !== input.id
          && candidate.quote_status !== 'lost'
          && candidate.quote_status !== 'archived';
        if (!isValidSibling) {
          throw new AppError('INVALID_NEW_PRIMARY', 400);
        }

        await auditRepository.recordDeletionAndPromoteSibling({
          entityId: input.id,
          entityTitle: quoteData.title || 'Untitled Quote',
          entityData: quoteData,
          reason: input.reason,
          performedBy: input.performedBy,
          performedByName: input.performedByName,
          clientId,
          clientName,
          newPrimaryId: input.newPrimaryQuoteId,
          newPrimaryExpiry: new Date(Date.now() + NEW_PRIMARY_EXPIRY_MS),
        });
        return;
      }
    }

    await auditRepository.recordDeletionAndSoftDeleteQuote({
      entityId: input.id,
      entityTitle: quoteData.title || 'Untitled Quote',
      entityData: quoteData,
      reason: input.reason,
      performedBy: input.performedBy,
      performedByName: input.performedByName,
      clientId,
      clientName,
    });
  },

  async deleteBooking(scope: Scope, input: DeleteByAdmin) {
    const bookingData = await auditRepository.findBookingById(input.id);
    if (!bookingData) throw new AppError('Booking not found', 404);

    const { orgId, clientId, clientName } = await auditRepository.resolveEntityClient(bookingData.transaction_id ?? null);

    const callerOrgId = effectiveOrgId(scope);
    if (callerOrgId && orgId !== callerOrgId) {
      throw new AppError('Booking not found', 404);
    }

    await auditRepository.recordDeletionAndDeleteBooking({
      entityId: input.id,
      entityTitle: bookingData.title || 'Untitled Booking',
      entityData: bookingData,
      reason: input.reason,
      performedBy: input.performedBy,
      performedByName: input.performedByName,
      clientId,
      clientName,
    });
  },
};
