import { useQuery } from "@tanstack/react-query";
import { usageApi, type OrgUsageSummary, type OrgUsageHistory } from "./usage.api";

export const usageKeys = {
  all:     ["usage"] as const,
  summary: () => [...usageKeys.all, "summary"] as const,
  history: (months: number) => [...usageKeys.all, "history", months] as const,
};

/** Current-month AI + SendSeven usage for the caller's own organization. */
export function useOrgUsageSummary() {
  return useQuery<OrgUsageSummary>({
    queryKey: usageKeys.summary(),
    queryFn:  usageApi.getSummary,
  });
}

/** Monthly usage history (default 6 months) for the caller's own organization. */
export function useOrgUsageHistory(months = 6) {
  return useQuery<OrgUsageHistory>({
    queryKey: usageKeys.history(months),
    queryFn:  () => usageApi.getHistory(months),
  });
}
