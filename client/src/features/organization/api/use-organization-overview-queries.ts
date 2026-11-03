import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  organizationOverviewApi,
  type OrganizationOverviewStats,
  type AgentsPerformanceParams,
  type AgentsPerformanceResponse,
  type BranchesPerformanceParams,
  type BranchesPerformanceResponse,
} from "./organization-overview.api";

export const organizationOverviewKeys = {
  all: ["organization-overview"] as const,
  stats: (branchId?: string) => [...organizationOverviewKeys.all, "stats", branchId ?? null] as const,
  agentsPerformance: (params: AgentsPerformanceParams) =>
    [...organizationOverviewKeys.all, "agents-performance", params] as const,
  branchesPerformance: (params: BranchesPerformanceParams) =>
    [...organizationOverviewKeys.all, "branches-performance", params] as const,
};

export function useOrganizationOverviewStats(branchId?: string) {
  return useQuery<OrganizationOverviewStats>({
    queryKey: organizationOverviewKeys.stats(branchId),
    queryFn: () => organizationOverviewApi.getStats({ branchId }),
    // Keep the previous branch's figures on screen while the next branch loads.
    placeholderData: keepPreviousData,
  });
}

export function useOrganizationAgentsPerformance(params: AgentsPerformanceParams) {
  return useQuery<AgentsPerformanceResponse>({
    queryKey: organizationOverviewKeys.agentsPerformance(params),
    queryFn: () => organizationOverviewApi.getAgentsPerformance(params),
    placeholderData: keepPreviousData,
  });
}

export function useOrganizationBranchesPerformance(params: BranchesPerformanceParams) {
  return useQuery<BranchesPerformanceResponse>({
    queryKey: organizationOverviewKeys.branchesPerformance(params),
    queryFn: () => organizationOverviewApi.getBranchesPerformance(params),
  });
}
