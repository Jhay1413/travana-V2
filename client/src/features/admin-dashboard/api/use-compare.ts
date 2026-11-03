import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { organizationOverviewKeys } from "@/features/organization/api/use-organization-overview-queries";
import type { CompareParams, OrganizationOverviewCompare } from "../types";
import { adminDashboardApi } from "./admin-dashboard.api";

export function useCompare(params: CompareParams) {
  const { period, against, branchId } = params;
  return useQuery<OrganizationOverviewCompare>({
    queryKey: [...organizationOverviewKeys.all, "compare", { period, against, branchId: branchId ?? null }],
    queryFn: () => adminDashboardApi.getCompare({ period, against, branchId }),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
