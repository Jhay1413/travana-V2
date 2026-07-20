import { AppError } from '../../utils/error-handler';
import { platformAdminRepository } from './platform-admin.repository';
import { platformAdminAuditRepository } from './platform-admin-audit.repository';
import { periodStartMonthsAgo } from './platform-admin-usage.repository';
import { usageService } from '../usage/usage.service';
import type { AdminActor } from './platform-admin.service';
import type {
  OrgUsageSummary,
  OrgUsageHistory,
  OrgUsageOverviewRow,
} from '../usage/usage.types';
import type { OrgUsageLimits, ModelPricing } from '@shared/schema';

export interface UsageLimitsPatch {
  planTier?: string;
  monthlyAiTokenLimit?: number | null;
  monthlyAiMessageLimit?: number | null;
  monthlySendsevenMsgLimit?: number | null;
  aiLimitsEnabled?: boolean;
  sendsevenLimitsEnabled?: boolean;
  enforcementMode?: 'monitor' | 'enforce';
  warnThresholdPct?: number;
}

export interface ModelPricingPatch {
  inputMicrosPerMtok: number;
  cachedInputMicrosPerMtok: number;
  outputMicrosPerMtok: number;
}

async function recordAudit(params: {
  actor:        AdminActor;
  action:       string;
  targetOrgId?: string;
  metadata?:    Record<string, unknown>;
}): Promise<void> {
  try {
    await platformAdminAuditRepository.create({
      actorUserId:  params.actor.userId,
      action:       params.action,
      targetOrgId:  params.targetOrgId ?? null,
      targetUserId: null,
      metadata:     params.metadata ?? {},
      ipAddress:    params.actor.ipAddress,
      userAgent:    params.actor.userAgent,
    });
  } catch (err) {
    console.error('[platform-admin-usage] audit write failed:', err);
  }
}

async function assertOrgExists(orgId: string): Promise<void> {
  const org = await platformAdminRepository.findOrgByIdWithCounts(orgId);
  if (!org) throw new AppError('Organization not found', 404);
}

export const platformAdminUsageService = {
  async getOrgUsage(orgId: string): Promise<OrgUsageSummary> {
    await assertOrgExists(orgId);
    return usageService.getOrgUsageSummary(orgId);
  },

  async getOrgUsageHistory(orgId: string, months: number): Promise<OrgUsageHistory> {
    await assertOrgExists(orgId);
    return usageService.getOrgUsageHistory(orgId, months);
  },

  async updateUsageLimits(orgId: string, patch: UsageLimitsPatch, actor: AdminActor): Promise<OrgUsageLimits> {
    await assertOrgExists(orgId);

    const before = await usageService.getLimits(orgId);
    const updated = await usageService.upsertLimits(orgId, patch);

    await recordAudit({
      actor,
      action: 'usage_limits.update',
      targetOrgId: orgId,
      metadata: { before, after: updated },
    });

    return updated;
  },

  async getUsageOverview(months: number): Promise<OrgUsageOverviewRow[]> {
    const periodFrom = periodStartMonthsAgo(months);
    return usageService.getUsageOverview(periodFrom);
  },

  async listModelPricing(): Promise<ModelPricing[]> {
    return usageService.listModelPricing();
  },

  async upsertModelPricing(model: string, patch: ModelPricingPatch, actor: AdminActor): Promise<ModelPricing> {
    const existing = await usageService.listModelPricing();
    const before = existing.find((p) => p.model === model) ?? null;

    const created = await usageService.createModelPricingVersion({
      model,
      inputMicrosPerMtok:       patch.inputMicrosPerMtok,
      cachedInputMicrosPerMtok: patch.cachedInputMicrosPerMtok,
      outputMicrosPerMtok:      patch.outputMicrosPerMtok,
    });

    await recordAudit({
      actor,
      action: 'model_pricing.update',
      metadata: { model, before, after: created },
    });

    return created;
  },
};
