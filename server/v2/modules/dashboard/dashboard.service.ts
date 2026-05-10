import { dashboardRepository } from "./dashboard.repository";
import type { DashboardStats } from "./dashboard.types";
import type { Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : (scope.orgId || null);
}

export const dashboardService = {
  async getStats(scope: Scope): Promise<DashboardStats> {
    return dashboardRepository.getStats(effectiveOrgId(scope));
  },

  async getMyProfit(userId: string): Promise<{ profitThisMonth: number }> {
    return dashboardRepository.getMyProfit(userId);
  },

  async getAgentStats(userId: string) {
    return dashboardRepository.getAgentStats(userId);
  },

  async getAdminOverviewStats(scope: Scope) {
    return dashboardRepository.getAdminOverviewStats(effectiveOrgId(scope));
  },
};
