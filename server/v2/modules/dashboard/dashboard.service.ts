import { dashboardRepository } from "./dashboard.repository";
import type { DashboardStats } from "./dashboard.types";
import type { Scope } from "../../utils/scope";
import { getLondonWindows } from "../../utils/london-time";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : (scope.orgId || null);
}

export const dashboardService = {
  async getStats(scope: Scope): Promise<DashboardStats> {
    return dashboardRepository.getStats(effectiveOrgId(scope));
  },

  async getMyProfit(userId: string, now: Date = new Date()): Promise<{ profitThisMonth: number }> {
    // Same London month window as getAgentStats so the figures always match.
    const { monthStart, monthEnd } = getLondonWindows(now);
    return dashboardRepository.getMyProfit(userId, { monthStart, monthEnd });
  },

  async getAgentStats(userId: string, now: Date = new Date()) {
    // Today / week (Monday) / month windows are London days, as UTC instants.
    const { todayStart, weekStart, monthStart, monthEnd } = getLondonWindows(now);
    return dashboardRepository.getAgentStats(userId, { todayStart, weekStart, monthStart, monthEnd });
  },

  async getAdminOverviewStats(scope: Scope) {
    return dashboardRepository.getAdminOverviewStats(effectiveOrgId(scope));
  },
};
