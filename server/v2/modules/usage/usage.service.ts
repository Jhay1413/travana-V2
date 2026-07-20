import { usageRepository } from "./usage.repository";
import { startOfMonthUtc } from "../platform-admin/platform-admin-credits.repository";
import type { ModelPricing } from "@shared/schema";
import type {
  RecordAiUsageInput,
  RecordSendsevenSendInput,
  UsageCheckResult,
  OrgUsageSummary,
  OrgUsageHistory,
  AiUsagePeriodSummary,
  SendsevenUsagePeriodSummary,
} from "./usage.types";

const MTOK = 1_000_000;

/**
 * Pure cost calculation: (prompt - cached) * input rate + cached * cached
 * rate + completion * output rate, each rate per 1,000,000 tokens. Rounded
 * to the nearest integer micro, never negative. `cachedTokens` is clamped to
 * `promptTokens` so a bad/oversized cached count can never invert the sum.
 */
export function computeCostMicros(
  pricing: ModelPricing | null,
  usage: { promptTokens: number; completionTokens: number; cachedTokens: number },
): number {
  if (!pricing) return 0;

  const cachedTokens = Math.max(0, Math.min(usage.cachedTokens, usage.promptTokens));
  const uncachedPromptTokens = Math.max(0, usage.promptTokens - cachedTokens);

  const cost =
    (uncachedPromptTokens * pricing.inputMicrosPerMtok) / MTOK +
    (cachedTokens * pricing.cachedInputMicrosPerMtok) / MTOK +
    (usage.completionTokens * pricing.outputMicrosPerMtok) / MTOK;

  return Math.max(0, Math.round(cost));
}

function evaluateLimit(
  used: number,
  limit: number | null | undefined,
  warnThresholdPct: number,
  enforce: boolean,
): UsageCheckResult {
  if (limit === null || limit === undefined) {
    return { allowed: true, remaining: null, warnThresholdCrossed: false };
  }
  const remaining = limit - used;
  const warnThresholdCrossed = limit > 0 && used >= (limit * warnThresholdPct) / 100;
  const allowed = enforce ? used < limit : true;
  return { allowed, remaining, warnThresholdCrossed };
}

/**
 * Record one LLM call's usage against the org's ledger + monthly aggregate.
 * FAIL-OPEN: any error here is logged and swallowed so a metering DB blip
 * never breaks a tenant's AI feature. Mirrors `consumeSmsCredit`.
 */
export async function recordAiUsage(input: RecordAiUsageInput): Promise<void> {
  try {
    const promptTokens = input.usage.promptTokens ?? 0;
    const completionTokens = input.usage.completionTokens ?? 0;
    const cachedTokens = input.usage.cachedTokens ?? 0;
    const totalTokens = input.usage.totalTokens ?? promptTokens + completionTokens;

    const pricing = await usageRepository.getLatestPricing(input.model);
    const costMicros = computeCostMicros(pricing, { promptTokens, completionTokens, cachedTokens });

    await usageRepository.insertEvent({
      orgId: input.orgId,
      feature: input.feature,
      site: input.site,
      model: input.model,
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens,
      costMicros,
      conversationId: input.conversationId,
      userId: input.userId ?? null,
    });

    await usageRepository.incrementAiMonthly(input.orgId, startOfMonthUtc(), {
      promptTokens,
      completionTokens,
      totalTokens,
      messageCount: input.feature === "embedding" ? 0 : 1,
      costMicros,
    });
  } catch (err) {
    console.error("[usage] recordAiUsage failed (fail-open; AI call already completed):", err);
  }
}

/**
 * Record one outbound SendSeven customer-facing message. FAIL-OPEN — never
 * block a send on a metering DB blip. Phase 1 has no cap enforcement here.
 */
export async function recordSendsevenSend(input: RecordSendsevenSendInput): Promise<void> {
  try {
    await usageRepository.consumeSendsevenMessage(input.orgId, startOfMonthUtc(), {
      isAi: input.source === "ai",
    });
  } catch (err) {
    console.error("[usage] recordSendsevenSend failed (fail-open; send already completed):", err);
  }
}

/**
 * In `monitor` mode (or when limits/enablement are missing) this always
 * returns `allowed: true` — it still reports `remaining`/`warnThresholdCrossed`
 * when a limit is configured so the UI can show a warning banner.
 * Enforcement callers land in Phase 2.
 */
export async function checkAiAllowed(orgId: string): Promise<UsageCheckResult> {
  const limits = await usageRepository.getLimits(orgId);
  if (!limits || !limits.aiLimitsEnabled) {
    return { allowed: true, remaining: null, warnThresholdCrossed: false };
  }

  const monthly = await usageRepository.getAiMonthly(orgId, startOfMonthUtc());
  const used = monthly?.totalTokens ?? 0;
  const enforce = limits.enforcementMode === "enforce";

  return evaluateLimit(used, limits.monthlyAiTokenLimit, limits.warnThresholdPct, enforce);
}

export async function checkSendsevenAllowed(orgId: string): Promise<UsageCheckResult> {
  const limits = await usageRepository.getLimits(orgId);
  if (!limits || !limits.sendsevenLimitsEnabled) {
    return { allowed: true, remaining: null, warnThresholdCrossed: false };
  }

  const monthly = await usageRepository.getSendsevenMonthly(orgId, startOfMonthUtc());
  const used = monthly?.sentCount ?? 0;
  const enforce = limits.enforcementMode === "enforce";

  return evaluateLimit(used, limits.monthlySendsevenMsgLimit, limits.warnThresholdPct, enforce);
}

export async function getOrgUsageSummary(orgId: string): Promise<OrgUsageSummary> {
  const periodStart = startOfMonthUtc();

  const [limits, aiMonthly, sendsevenMonthly, aiUsageCheck, sendsevenUsageCheck] = await Promise.all([
    usageRepository.getLimits(orgId),
    usageRepository.getAiMonthly(orgId, periodStart),
    usageRepository.getSendsevenMonthly(orgId, periodStart),
    checkAiAllowed(orgId),
    checkSendsevenAllowed(orgId),
  ]);

  const ai: AiUsagePeriodSummary = {
    periodStart,
    promptTokens: aiMonthly?.promptTokens ?? 0,
    completionTokens: aiMonthly?.completionTokens ?? 0,
    totalTokens: aiMonthly?.totalTokens ?? 0,
    messageCount: aiMonthly?.messageCount ?? 0,
    costMicros: aiMonthly?.costMicros ?? 0,
  };

  const sendseven: SendsevenUsagePeriodSummary = {
    periodStart,
    sentCount: sendsevenMonthly?.sentCount ?? 0,
    aiSentCount: sendsevenMonthly?.aiSentCount ?? 0,
  };

  return {
    orgId,
    ai,
    sendseven,
    limits: limits
      ? {
          planTier: limits.planTier,
          monthlyAiTokenLimit: limits.monthlyAiTokenLimit,
          monthlyAiMessageLimit: limits.monthlyAiMessageLimit,
          monthlySendsevenMsgLimit: limits.monthlySendsevenMsgLimit,
          aiLimitsEnabled: limits.aiLimitsEnabled,
          sendsevenLimitsEnabled: limits.sendsevenLimitsEnabled,
          enforcementMode: limits.enforcementMode,
          warnThresholdPct: limits.warnThresholdPct,
        }
      : null,
    aiUsageCheck,
    sendsevenUsageCheck,
  };
}

export async function getOrgUsageHistory(orgId: string, months = 6): Promise<OrgUsageHistory> {
  const { ai, sendseven } = await usageRepository.getOrgHistory(orgId, months);

  return {
    orgId,
    ai: ai.map((row) => ({
      periodStart: row.periodStart,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      messageCount: row.messageCount,
      costMicros: row.costMicros,
    })),
    sendseven: sendseven.map((row) => ({
      periodStart: row.periodStart,
      sentCount: row.sentCount,
      aiSentCount: row.aiSentCount,
    })),
  };
}

export const usageService = {
  computeCostMicros,
  recordAiUsage,
  recordSendsevenSend,
  checkAiAllowed,
  checkSendsevenAllowed,
  getOrgUsageSummary,
  getOrgUsageHistory,
};
