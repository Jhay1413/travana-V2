import { useQuery } from "@tanstack/react-query";
import { branchOverviewApi } from "@/api";
import type { BranchOverviewStats } from "@/api/endpoints/branch-overview.api";

export const branchOverviewKeys = {
  all: ["branch-overview"] as const,
  stats: () => [...branchOverviewKeys.all, "stats"] as const,
};

export function useBranchOverviewStats() {
  return useQuery<BranchOverviewStats>({
    queryKey: branchOverviewKeys.stats(),
    queryFn: branchOverviewApi.getStats,
  });
}
