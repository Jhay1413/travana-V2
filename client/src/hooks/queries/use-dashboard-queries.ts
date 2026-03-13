import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api";
import type { DashboardStats } from "@/types/dashboard";
import type { MyProfit, AdminOverviewStats } from "@/api/endpoints/dashboard.api";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: () => [...dashboardKeys.all, "stats"] as const,
  myProfit: () => [...dashboardKeys.all, "my-profit"] as const,
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
