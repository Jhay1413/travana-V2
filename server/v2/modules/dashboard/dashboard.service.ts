import { dashboardRepository } from "./dashboard.repository";
import type { DashboardStats } from "./dashboard.types";

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    return await dashboardRepository.getStats();
  },

  async getMyProfit(userId: string): Promise<{ profitThisMonth: number }> {
    return await dashboardRepository.getMyProfit(userId);
  },

  async getAdminOverviewStats() {
    return await dashboardRepository.getAdminOverviewStats();
  },
};
