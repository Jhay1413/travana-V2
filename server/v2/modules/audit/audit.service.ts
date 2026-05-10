import { auditRepository } from './audit.repository';
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
}

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
