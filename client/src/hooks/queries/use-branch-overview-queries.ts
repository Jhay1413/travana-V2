import { useQuery } from "@tanstack/react-query";
import { branchOverviewApi } from "@/api";
import type {
  BranchOverviewStats,
  AgentsPerformanceParams,
  AgentsPerformanceResponse,
} from "@/api/endpoints/branch-overview.api";

export const branchOverviewKeys = {
  all: ["branch-overview"] as const,
  stats: (branchId?: string) =>
    [...branchOverviewKeys.all, "stats", branchId ?? null] as const,
  agentsPerformance: (params: AgentsPerformanceParams, branchId?: string) =>
    [...branchOverviewKeys.all, "agents-performance", params, branchId ?? null] as const,
};

export function useBranchOverviewStats(branchId?: string) {
  return useQuery<BranchOverviewStats>({
    queryKey: branchOverviewKeys.stats(branchId),
    queryFn: () => branchOverviewApi.getStats(branchId),
  });
}

export function useAgentsPerformance(params: AgentsPerformanceParams, branchId?: string) {
  return useQuery<AgentsPerformanceResponse>({
    queryKey: branchOverviewKeys.agentsPerformance(params, branchId),
    queryFn: () => branchOverviewApi.getAgentsPerformance(params, branchId),
  });
}
