/**
 * Types for the per-org AI + SendSeven usage metering module.
 * See docs/ai-usage-limits-plan.md — Phase 1 (monitor-only, no enforcement).
 */

export type AiUsageFeature =
  | "staff_chat"
  | "sendseven_bot"
  | "enquiry_ai"
  | "ai_ask"
  | "destination_guru"
  | "social_post"
  | "embedding"
  | "staff_chat_test";

export interface AiUsageTokens {
  promptTokens: number;
  completionTokens: number;
  cachedTokens?: number;
  totalTokens?: number;
}

export interface RecordAiUsageInput {
  orgId: string;
  feature: AiUsageFeature;
  site?: string;
  model: string;
  usage: AiUsageTokens;
  conversationId?: string;
  userId?: string | null;
}

export type SendsevenSendSource = "manual" | "ai";

export interface RecordSendsevenSendInput {
  orgId: string;
  source: SendsevenSendSource;
}

export interface UsageCheckResult {
  allowed: boolean;
  remaining: number | null;
  warnThresholdCrossed: boolean;
}

export interface AiUsagePeriodSummary {
  periodStart: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  messageCount: number;
  costMicros: number;
}

export interface SendsevenUsagePeriodSummary {
  periodStart: string;
  sentCount: number;
  aiSentCount: number;
}

export interface OrgUsageSummary {
  orgId: string;
  ai: AiUsagePeriodSummary;
  sendseven: SendsevenUsagePeriodSummary;
  limits: {
    planTier: string;
    monthlyAiTokenLimit: number | null;
    monthlyAiMessageLimit: number | null;
    monthlySendsevenMsgLimit: number | null;
    aiLimitsEnabled: boolean;
    sendsevenLimitsEnabled: boolean;
    enforcementMode: string;
    warnThresholdPct: number;
  } | null;
  aiUsageCheck: UsageCheckResult;
  sendsevenUsageCheck: UsageCheckResult;
}

export interface OrgUsageHistory {
  orgId: string;
  ai: AiUsagePeriodSummary[];
  sendseven: SendsevenUsagePeriodSummary[];
}
