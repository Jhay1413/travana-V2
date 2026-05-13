import { useQuery } from "@tanstack/react-query";
import { branchOverviewApi } from "@/api";
import type {
  BranchOverviewStats,
  AgentsPerformanceParams,
  AgentsPerformanceResponse,
} from "@/api/endpoints/branch-overview.api";

export const branchOverviewKeys = {
  all: ["branch-overview"] as const,
  stats: () => [...branchOverviewKeys.all, "stats"] as const,
  agentsPerformance: (params: AgentsPerformanceParams) =>
    [...branchOverviewKeys.all, "agents-performance", params] as const,
};

export function useBranchOverviewStats() {
  return useQuery<BranchOverviewStats>({
    queryKey: branchOverviewKeys.stats(),
    queryFn: branchOverviewApi.getStats,
  });
}

export function useAgentsPerformance(params: AgentsPerformanceParams) {
  return useQuery<AgentsPerformanceResponse>({
    queryKey: branchOverviewKeys.agentsPerformance(params),
    queryFn: () => branchOverviewApi.getAgentsPerformance(params),
  });
}
