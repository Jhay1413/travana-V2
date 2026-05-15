import { useQuery } from "@tanstack/react-query";
import { organizationOverviewApi } from "@/api";
import type {
  OrganizationOverviewStats,
  AgentsPerformanceParams,
  AgentsPerformanceResponse,
} from "@/api/endpoints/organization-overview.api";

export const organizationOverviewKeys = {
  all: ["organization-overview"] as const,
  stats: () => [...organizationOverviewKeys.all, "stats"] as const,
  agentsPerformance: (params: AgentsPerformanceParams) =>
    [...organizationOverviewKeys.all, "agents-performance", params] as const,
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
