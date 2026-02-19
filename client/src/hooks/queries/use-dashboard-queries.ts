import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { dashboardApi } from "@/api";
import type { DashboardStats, ClientDashboardKPIs, RebookingDashboard, VIPDashboard, BehaviourDashboard, ClientListResponse } from "@/types/dashboard";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: () => [...dashboardKeys.all, "stats"] as const,
  clientKPIs: () => [...dashboardKeys.all, "client-kpis"] as const,
  rebooking: () => [...dashboardKeys.all, "rebooking"] as const,
  vip: () => [...dashboardKeys.all, "vip"] as const,
  behaviour: () => [...dashboardKeys.all, "behaviour"] as const,
  clientList: (params: Record<string, unknown>) => [...dashboardKeys.all, "client-list", params] as const,
};

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: dashboardKeys.stats(),
    queryFn: dashboardApi.getStats,
  });
}

export function useClientKPIs() {
  return useQuery<ClientDashboardKPIs>({
    queryKey: dashboardKeys.clientKPIs(),
    queryFn: dashboardApi.getClientKPIs,
    staleTime: 60_000,
  });
}

export function useRebookingDashboard() {
  return useQuery<RebookingDashboard>({
    queryKey: dashboardKeys.rebooking(),
    queryFn: dashboardApi.getRebooking,
    staleTime: 60_000,
  });
}

export function useVIPDashboard() {
  return useQuery<VIPDashboard>({
    queryKey: dashboardKeys.vip(),
    queryFn: dashboardApi.getVIP,
    staleTime: 60_000,
  });
}

export function useBehaviourDashboard() {
  return useQuery<BehaviourDashboard>({
    queryKey: dashboardKeys.behaviour(),
    queryFn: dashboardApi.getBehaviour,
    staleTime: 60_000,
  });
}

export function useClientDashboardList(params?: { page?: number; limit?: number; sortBy?: string; sortDir?: string; search?: string }) {
  return useQuery<ClientListResponse>({
    queryKey: dashboardKeys.clientList(params || {}),
    queryFn: () => dashboardApi.getClientList(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
