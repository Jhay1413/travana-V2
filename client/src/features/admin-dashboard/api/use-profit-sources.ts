import { useQuery } from "@tanstack/react-query";
import { organizationOverviewKeys } from "@/features/organization/api/use-organization-overview-queries";
import type { ProfitSourcesResponse } from "../types";
import { adminDashboardApi } from "./admin-dashboard.api";

export function useProfitSources(branchId?: string) {
  return useQuery<ProfitSourcesResponse>({
    queryKey: [...organizationOverviewKeys.all, "profit-sources", branchId ?? null],
    queryFn: () => adminDashboardApi.getProfitSources(branchId),
    retry: false,
  });
}
