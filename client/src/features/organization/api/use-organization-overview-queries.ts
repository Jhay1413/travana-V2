import { useQuery } from "@tanstack/react-query";
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
  stats: () => [...organizationOverviewKeys.all, "stats"] as const,
  agentsPerformance: (params: AgentsPerformanceParams) =>
    [...organizationOverviewKeys.all, "agents-performance", params] as const,
  branchesPerformance: (params: BranchesPerformanceParams) =>
    [...organizationOverviewKeys.all, "branches-performance", params] as const,
};

export function useOrganizationOverviewStats() {
  return useQuery<OrganizationOverviewStats>({
    queryKey: organizationOverviewKeys.stats(),
    queryFn: organizationOverviewApi.getStats,
  });
}

export function useOrganizationAgentsPerformance(params: AgentsPerformanceParams) {
  return useQuery<AgentsPerformanceResponse>({
    queryKey: organizationOverviewKeys.agentsPerformance(params),
    queryFn: () => organizationOverviewApi.getAgentsPerformance(params),
  });
}

export function useOrganizationBranchesPerformance(params: BranchesPerformanceParams) {
  return useQuery<BranchesPerformanceResponse>({
    queryKey: organizationOverviewKeys.branchesPerformance(params),
    queryFn: () => organizationOverviewApi.getBranchesPerformance(params),
  });
}
