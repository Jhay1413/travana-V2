import { AppError } from '../../utils/error-handler';
import { platformAdminRepository } from './platform-admin.repository';
import {
  platformAdminCreditsRepository,
  startOfMonthUtc,
  type ChargeFilters,
} from './platform-admin-credits.repository';
import { platformAdminAuditRepository } from './platform-admin-audit.repository';
import type { AdminActor } from './platform-admin.service';
import type { SmsCreditUsage, SmsCreditCharge } from '@shared/schema';

export interface CreditSummary {
  enabled:           boolean;
  monthlyLimit:      number;
  overagePriceCents: number;
  currentPeriod: {
    periodStart:    string;        // ISO date
    creditsUsed:    number;
    creditsGranted: number;
    allowance:      number;
    remaining:      number;
    overageCredits: number;
  };
  pendingChargesCents: number;
}

async function recordAudit(params: {
  actor:        AdminActor;
  action:       string;
  targetOrgId:  string;
  metadata?:    Record<string, unknown>;
}): Promise<void> {
  try {
    await platformAdminAuditRepository.create({
      actorUserId:  params.actor.userId,
      action:       params.action,
      targetOrgId:  params.targetOrgId,
      targetUserId: null,
      metadata:     params.metadata ?? {},
      ipAddress:    params.actor.ipAddress,
      userAgent:    params.actor.userAgent,
    });
  } catch (err) {
    console.error('[platform-admin-credits] audit write failed:', err);
  }
}

export const platformAdminCreditsService = {
  async getSummary(orgId: string): Promise<CreditSummary> {
    const org = await platformAdminRepository.findOrgByIdWithCounts(orgId);
    if (!org) throw new AppError('Organization not found', 404);

    const cfg = await platformAdminCreditsRepository.findOrgCreditConfig(orgId);
    if (!cfg) throw new AppError('Organization credit config missing', 500);

    const periodStart = startOfMonthUtc();
    const usage       = await platformAdminCreditsRepository.findCurrentUsage(orgId, periodStart);
    const pending     = await platformAdminCreditsRepository.sumPendingCharges(orgId);

    const creditsUsed    = usage?.creditsUsed    ?? 0;
    const creditsGranted = usage?.creditsGranted ?? 0;
    const allowance      = cfg.monthlySmsCreditLimit + creditsGranted;

    return {
      enabled:           cfg.smsCreditsEnabled,
      monthlyLimit:      cfg.monthlySmsCreditLimit,
      overagePriceCents: cfg.smsOveragePriceCents,
      currentPeriod: {
        periodStart,
        creditsUsed,
        creditsGranted,
        allowance,
        remaining:      Math.max(0, allowance - creditsUsed),
        overageCredits: Math.max(0, creditsUsed - allowance),
      },
      pendingChargesCents: pending,
    };
  },

  async updateLimit(orgId: string, limit: number, enabled: boolean | undefined, actor: AdminActor): Promise<void> {
    if (!Number.isInteger(limit) || limit < 0) throw new AppError('Limit must be a non-negative integer', 400);
    const cfg = await platformAdminCreditsRepository.findOrgCreditConfig(orgId);
    if (!cfg) throw new AppError('Organization not found', 404);
    await platformAdminCreditsRepository.setMonthlyLimit(orgId, limit, enabled);
    await recordAudit({
      actor,
      action: 'org.credit.limit.change',
      targetOrgId: orgId,
      metadata: {
        from: { limit: cfg.monthlySmsCreditLimit, enabled: cfg.smsCreditsEnabled },
        to:   { limit, enabled: enabled ?? cfg.smsCreditsEnabled },
      },
    });
  },

  async updateOveragePrice(orgId: string, cents: number, actor: AdminActor): Promise<void> {
    if (!Number.isInteger(cents) || cents < 0) throw new AppError('Price must be a non-negative integer (in cents)', 400);
    const cfg = await platformAdminCreditsRepository.findOrgCreditConfig(orgId);
    if (!cfg) throw new AppError('Organization not found', 404);
    await platformAdminCreditsRepository.setOveragePriceCents(orgId, cents);
    await recordAudit({
      actor,
      action: 'org.credit.price.change',
      targetOrgId: orgId,
      metadata: { from: cfg.smsOveragePriceCents, to: cents },
    });
  },

  async topUp(orgId: string, credits: number, actor: AdminActor, reason?: string): Promise<void> {
    if (!Number.isInteger(credits) || credits <= 0) throw new AppError('Top-up must be a positive integer', 400);
    const cfg = await platformAdminCreditsRepository.findOrgCreditConfig(orgId);
    if (!cfg) throw new AppError('Organization not found', 404);

    const periodStart = startOfMonthUtc();
    await platformAdminCreditsRepository.addGrantedCredits(orgId, periodStart, credits);
    await recordAudit({
      actor,
      action: 'org.credit.topup',
      targetOrgId: orgId,
      metadata: { credits, periodStart, reason: reason ?? null },
    });
  },

  async listUsageHistory(orgId: string, months: number): Promise<SmsCreditUsage[]> {
    return platformAdminCreditsRepository.findUsageByOrg(orgId, months);
  },

  async listCharges(orgId: string, filters: ChargeFilters): Promise<SmsCreditCharge[]> {
    return platformAdminCreditsRepository.findChargesByOrg(orgId, filters);
  },

  async writeOffCharge(orgId: string, chargeId: string, actor: AdminActor, reason?: string): Promise<void> {
    const charge = await platformAdminCreditsRepository.findChargeById(orgId, chargeId);
    if (!charge) throw new AppError('Charge not found', 404);
    if (charge.status !== 'pending') throw new AppError('Only pending charges can be written off', 400);

    await platformAdminCreditsRepository.markWrittenOff(orgId, chargeId);
    await recordAudit({
      actor,
      action: 'org.credit.charge.write_off',
      targetOrgId: orgId,
      metadata: {
        chargeId,
        amountCents: charge.amountCents,
        reason: reason ?? null,
      },
    });
  },
};
