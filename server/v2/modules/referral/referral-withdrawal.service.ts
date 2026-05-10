import { referralWithdrawalRepository } from './referral-withdrawal.repository';
import { referralRepository } from './referral.repository';
import { vipEnrollmentService } from '../../../services/vipEnrollment.service';
import {
  generateWithdrawalInvoiceBuffer,
  uploadWithdrawalInvoice,
} from '../../../services/invoicePdf.service';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === 'platform_admin') return null;
  return (scope as Scope).orgId || null;
}

async function loadScopedWithdrawal(id: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const w = await referralWithdrawalRepository.findById(id);
    if (!w) throw new AppError('Withdrawal not found', 404);
    return w;
  }

  const row = await referralWithdrawalRepository.findByIdWithOrg(id);
  if (!row || row.clientOrgId !== orgId) {
    throw new AppError('Withdrawal not found', 404);
  }
  const w = await referralWithdrawalRepository.findById(id);
  if (!w) throw new AppError('Withdrawal not found', 404);
  return w;
}

export const referralWithdrawalService = {
  async listWithdrawals(scope: ScopeOrTrusted) {
    return referralWithdrawalRepository.findAll(effectiveOrgId(scope));
  },

  async getWithdrawalById(id: string, scope: ScopeOrTrusted) {
    return loadScopedWithdrawal(id, scope);
  },

  async getWithdrawalsByClient(clientId: string) {
    return referralWithdrawalRepository.findByClientId(clientId);
  },

  async requestWithdrawal(data: {
    referralId: string;
    clientId: string;
    method: 'bank_transfer' | 'booking_credit';
    account_name?: string;
    account_number?: string;
    sort_code?: string;
    booking_id?: string;
  }) {
    const referralRecord = await referralRepository.findById(data.referralId);
    if (!referralRecord) throw new AppError('Referral not found', 404);
    if (referralRecord.referralStatus !== 'IN_WALLET') {
      throw new AppError('Referral must be IN_WALLET before a withdrawal can be requested', 400);
    }
    if (!referralRecord.payoutAmount) throw new AppError('Referral has no payout amount', 400);

    const existing = await referralWithdrawalRepository.findByReferralId(data.referralId);
    if (existing && existing.status === 'pending') return existing;

    if (data.method === 'bank_transfer') {
      if (!data.account_name || !data.account_number || !data.sort_code) {
        throw new AppError('Account name, account number and sort code are required for bank transfer', 400);
      }
    }

    return referralWithdrawalRepository.create({
      referral_id: data.referralId,
      client_id: data.clientId,
      amount: referralRecord.payoutAmount,
      method: data.method,
      status: 'pending',
      account_name: data.account_name,
      account_number: data.account_number,
      sort_code: data.sort_code,
      booking_id: data.booking_id,
    });
  },

  async processWithdrawal(
    id: string,
    data: {
      transfer_reference?: string;
      booking_id?: string;
      credit_note?: string;
      notes?: string;
    },
    scope: ScopeOrTrusted,
  ) {
    const withdrawal = await loadScopedWithdrawal(id, scope);
    if (withdrawal.status === 'processed') throw new AppError('Withdrawal has already been processed', 400);
    if (withdrawal.status === 'rejected') throw new AppError('Cannot process a rejected withdrawal', 400);

    if (withdrawal.method === 'bank_transfer' && !data.transfer_reference) {
      throw new AppError('Transfer reference is required when confirming a bank transfer', 400);
    }
    if (withdrawal.method === 'booking_credit' && !data.booking_id && !data.credit_note) {
      throw new AppError('Booking ID or credit note is required when applying booking credit', 400);
    }

    const updated = await referralWithdrawalRepository.markProcessed(id, data);

    try {
      const details = await referralWithdrawalRepository.findByIdWithDetails(id);
      if (details) {
        const clientName =
          [details.clientFirstName, details.clientSurname].filter(Boolean).join(' ') || 'Client';
        const pdfBuffer = await generateWithdrawalInvoiceBuffer({
          withdrawalId: id,
          requestedAt: details.requested_at,
          processedAt: updated.processed_at ?? null,
          clientName,
          clientEmail: details.clientEmail ?? null,
          clientPhone: details.clientPhone ?? null,
          amount: details.amount,
          method: details.method,
          accountName: details.account_name ?? null,
          accountNumber: details.account_number ?? null,
          sortCode: details.sort_code ?? null,
          transferReference: details.transfer_reference ?? data.transfer_reference ?? null,
          bookingHaysRef: details.bookingHaysRef ?? null,
          bookingSupplierRef: details.bookingSupplierRef ?? null,
          travelDate: details.travelDate ?? null,
          referredName: details.referredName ?? null,
          referredEmail: details.referredEmail ?? null,
        });
        const s3Key = await uploadWithdrawalInvoice(id, pdfBuffer);
        await referralWithdrawalRepository.markProcessed(id, { invoice_url: s3Key });
      }
    } catch (err) {
      console.error('[invoice] Failed to generate withdrawal invoice:', err);
    }

    const referralRecord = await referralRepository.findById(withdrawal.referral_id);
    await referralRepository.updateStatus(withdrawal.referral_id, 'PAID');

    if (referralRecord?.referrerClientId) {
      await vipEnrollmentService.recalculateTier(referralRecord.referrerClientId);
    }

    return updated;
  },

  async rejectWithdrawal(id: string, notes: string | undefined, scope: ScopeOrTrusted) {
    const withdrawal = await loadScopedWithdrawal(id, scope);
    if (withdrawal.status !== 'pending') throw new AppError('Only pending withdrawals can be rejected', 400);

    await referralRepository.updateStatus(withdrawal.referral_id, 'IN_WALLET');
    return referralWithdrawalRepository.markRejected(id, notes);
  },

  async getTotalPaidByClient(clientId: string): Promise<number> {
    return referralWithdrawalRepository.sumProcessedByClientId(clientId);
  },

  async applyBookingCreditAdmin(clientId: string, bookingId: string, requestedAmount: number) {
    if (requestedAmount <= 0) throw new AppError('Amount must be greater than 0', 400);

    const referrals = await referralRepository.findByReferrerClientId(clientId);
    const eligible = referrals
      .filter((r: any) => r.referralStatus === 'IN_WALLET')
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const available = eligible.reduce(
      (sum: number, r: any) => sum + parseFloat(r.payoutAmount ?? '0'),
      0,
    );

    if (available <= 0) throw new AppError('No wallet balance available to apply', 400);
    if (requestedAmount > available + 0.001) {
      throw new AppError(`Requested amount exceeds available balance of £${available.toFixed(2)}`, 400);
    }

    const created = [];
    let remaining = requestedAmount;

    for (const r of eligible) {
      if (remaining <= 0.001) break;
      const referralBalance = parseFloat(r.payoutAmount ?? '0');
      if (referralBalance <= 0) continue;

      const existing = await referralWithdrawalRepository.findByReferralId(r.id);
      if (existing && existing.status === 'pending') continue;

      const allocate = Math.min(remaining, referralBalance);
      const w = await referralWithdrawalRepository.create({
        referral_id: r.id,
        client_id: clientId,
        amount: allocate.toFixed(2),
        method: 'booking_credit',
        status: 'pending',
        booking_id: bookingId,
      });
      created.push(w);
      remaining -= allocate;
    }

    const totalApplied = (requestedAmount - Math.max(remaining, 0)).toFixed(2);
    return { referralCount: created.length, totalAmount: totalApplied };
  },
};
