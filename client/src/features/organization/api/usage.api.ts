import axiosClient from "@/api/client/axios-client";

// Org-scoped AI + SendSeven usage (see docs/ai-usage-limits-plan.md). Unlike
// the platform-admin usage endpoints (which take an explicit orgId), these
// endpoints derive the caller's org from the session scope — no orgId is
// ever sent from the client. Cost/margin fields are intentionally NOT part
// of these DTOs — that's internal pricing data reserved for platform admins.

export interface OrgUsageAiSummary {
  periodStart:      string;
  promptTokens:     number;
  completionTokens: number;
  totalTokens:      number;
  messageCount:     number;
}

export interface OrgUsageSendsevenSummary {
  periodStart: string;
  sentCount:   number;
  aiSentCount: number;
}

export interface OrgUsageLimits {
  planTier:                  string;
  monthlyAiTokenLimit:       number | null;
  monthlyAiMessageLimit:     number | null;
  monthlySendsevenMsgLimit:  number | null;
  aiLimitsEnabled:           boolean;
  sendsevenLimitsEnabled:    boolean;
  enforcementMode:           string;
  warnThresholdPct:          number;
}

export interface UsageCheckResult {
  allowed:              boolean;
  remaining:            number | null;
  warnThresholdCrossed: boolean;
}

export interface OrgUsageSummary {
  orgId:               string;
  ai:                  OrgUsageAiSummary;
  sendseven:           OrgUsageSendsevenSummary;
  limits:              OrgUsageLimits | null;
  aiUsageCheck:        UsageCheckResult;
  sendsevenUsageCheck: UsageCheckResult;
}

export interface OrgUsageHistory {
  orgId:     string;
  ai:        OrgUsageAiSummary[];
  sendseven: OrgUsageSendsevenSummary[];
}

export const usageApi = {
  getSummary: async (): Promise<OrgUsageSummary> => {
    const { data } = await axiosClient.get<OrgUsageSummary>("/api/v2/usage/summary");
    return data;
  },
  getHistory: async (months = 6): Promise<OrgUsageHistory> => {
    const { data } = await axiosClient.get<OrgUsageHistory>("/api/v2/usage/history", {
      params: { months },
    });
    return data;
  },
};
