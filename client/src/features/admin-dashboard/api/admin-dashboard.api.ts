import axiosClient from "@/api/client/axios-client";
import { ORGANIZATION_OVERVIEW_ENDPOINTS } from "@/api/endpoints";
import type { CompareParams, OrganizationOverviewCompare, ProfitSourcesResponse } from "../types";

export const adminDashboardApi = {
  getCompare: async (params: CompareParams): Promise<OrganizationOverviewCompare> => {
    const { data } = await axiosClient.get<{ data: OrganizationOverviewCompare }>(
      ORGANIZATION_OVERVIEW_ENDPOINTS.compare,
      { params: { period: params.period, against: params.against, ...(params.branchId ? { branchId: params.branchId } : {}) } },
    );
    return data?.data ?? (data as unknown as OrganizationOverviewCompare);
  },
  getProfitSources: async (branchId?: string): Promise<ProfitSourcesResponse> => {
    const { data } = await axiosClient.get<{ data: ProfitSourcesResponse }>(
      ORGANIZATION_OVERVIEW_ENDPOINTS.profitSources,
      { params: branchId ? { branchId } : undefined },
    );
    return data?.data ?? (data as unknown as ProfitSourcesResponse);
  },
};
