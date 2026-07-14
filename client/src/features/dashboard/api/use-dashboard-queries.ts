import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api";
import type { DashboardStats } from "@/features/dashboard/types";
import type { MyProfit, AdminOverviewStats, AgentStats } from "./dashboard.api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: () => [...dashboardKeys.all, "stats"] as const,
  myProfit: () => [...dashboardKeys.all, "my-profit"] as const,
  agentStats: () => [...dashboardKeys.all, "agent-stats"] as const,
  adminOverview: () => [...dashboardKeys.all, "admin-overview"] as const,
};

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: dashboardKeys.stats(),
    queryFn: dashboardApi.getStats,
  });
}

export function useMyProfit() {
  return useQuery<MyProfit>({
    queryKey: dashboardKeys.myProfit(),
    queryFn: dashboardApi.getMyProfit,
  });
}

export function useAdminOverviewStats() {
  return useQuery<AdminOverviewStats>({
    queryKey: dashboardKeys.adminOverview(),
    queryFn: dashboardApi.getAdminOverviewStats,
  });
}

export function useAgentStats(options?: { enabled?: boolean }) {
  return useQuery<AgentStats>({
    queryKey: dashboardKeys.agentStats(),
    queryFn: dashboardApi.getAgentStats,
    enabled: options?.enabled ?? true,
    // Always refetch on visit — overrides the global 30s staleTime so the
    // agent dashboard stats are never served stale from cache.
    staleTime: 0,
  });
}
