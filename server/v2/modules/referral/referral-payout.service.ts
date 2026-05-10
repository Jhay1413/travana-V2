import { referralPayoutRepository } from './referral-payout.repository';
import { referralRepository } from './referral.repository';
import { vipEnrollmentService } from '../../../services/vipEnrollment.service';
import { AppError } from '../../utils/error-handler';
import type { Scope } from '../../utils/scope';

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === 'platform_admin') return null;
  return (scope as Scope).orgId || null;
}

async function loadScopedPayout(id: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) {
    const p = await referralPayoutRepository.findById(id);
    if (!p) throw new AppError('Payout request not found', 404);
    return p;
  }

  const row = await referralPayoutRepository.findByIdWithOrg(id);
  if (!row || row.clientOrgId !== orgId) {
    throw new AppError('Payout request not found', 404);
  }
  const p = await referralPayoutRepository.findById(id);
  if (!p) throw new AppError('Payout request not found', 404);
  return p;
}

export const referralPayoutService = {
  async listPayouts(scope: ScopeOrTrusted) {
    return referralPayoutRepository.findAll(effectiveOrgId(scope));
  },

  async getPayoutById(id: string, scope: ScopeOrTrusted) {
    return loadScopedPayout(id, scope);
  },

  async getPayoutsByClient(clientId: string) {
    return referralPayoutRepository.findByClientId(clientId);
  },

  async requestPayouts(referrerClientId: string) {
    const referrals = await referralRepository.findByReferrerClientId(referrerClientId);
    const eligible = referrals.filter(
      (r: any) => r.referralStatus === 'PENDING' && r.isDue,
    );

    if (eligible.length === 0) {
      throw new AppError(
        'No eligible referrals to request payout for. Referrals must be pending and due (8 weeks before travel).',
        400,
      );
    }

    const deduped = (
      await Promise.all(
        eligible.map(async (r: any) => {
          const existing = await referralPayoutRepository.findByReferralId(r.id);
          return existing && existing.status === 'requested' ? null : r;
        }),
      )
    ).filter(Boolean);

    if (deduped.length === 0) {
      throw new AppError(
        'A payout request is already pending for your eligible referrals. Please wait for your agent to review it.',
        400,
      );
    }

    const created = await Promise.all(
      deduped.map((r: any) =>
        referralPayoutRepository.create({
          referral_id: r.id,
          client_id: referrerClientId,
          amount: r.payoutAmount ?? '0',
          status: 'requested',
        }),
      ),
    );

    const totalAmount = deduped.reduce(
      (sum: number, r: any) => sum + parseFloat(r.payoutAmount ?? '0'),
      0,
    );

    return { count: created.length, totalAmount: totalAmount.toFixed(2) };
  },

  async approvePayout(id: string, notes: string | undefined, scope: ScopeOrTrusted) {
    const payout = await loadScopedPayout(id, scope);
    if (payout.status !== 'requested') throw new AppError('Only requested payouts can be approved', 400);

    const referralRecord = await referralRepository.findById(payout.referral_id);
    if (!referralRecord) throw new AppError('Referral not found', 404);
    if (referralRecord.referralStatus !== 'PENDING') throw new AppError('Referral must be PENDING to approve payout', 400);

    const updated = await referralPayoutRepository.markApproved(id, notes);
    await referralRepository.updateStatus(payout.referral_id, 'IN_WALLET');

    if (referralRecord.referrerClientId) {
      await vipEnrollmentService.recalculateTier(referralRecord.referrerClientId);
    }

    return updated;
  },

  async rejectPayout(id: string, notes: string | undefined, scope: ScopeOrTrusted) {
    const payout = await loadScopedPayout(id, scope);
    if (payout.status !== 'requested') throw new AppError('Only requested payouts can be rejected', 400);
    return referralPayoutRepository.markRejected(id, notes);
  },

  async getTotalEarningsByClient(clientId: string): Promise<number> {
    const rows = await referralPayoutRepository.findByClientId(clientId);
    return rows
      .filter((p) => p.status === 'approved')
      .reduce((sum, p) => sum + parseFloat(p.amount ?? '0'), 0);
  },
};
