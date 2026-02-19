import { dashboardRepository } from "../repositories/dashboard.repository";
import type {
  DashboardStats,
  ClientDashboardKPIs,
  RebookingDashboard,
  VIPDashboard,
  BehaviourDashboard,
  ClientListResponse,
} from "../types/dashboard";

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    return await dashboardRepository.getStats();
  },

  async getClientKPIs(): Promise<ClientDashboardKPIs> {
    return await dashboardRepository.getClientKPIs();
  },

  async getRebookingDashboard(): Promise<RebookingDashboard> {
    return await dashboardRepository.getRebookingDashboard();
  },

  async getVIPDashboard(): Promise<VIPDashboard> {
    return await dashboardRepository.getVIPDashboard();
  },

  async getBehaviourDashboard(): Promise<BehaviourDashboard> {
    return await dashboardRepository.getBehaviourDashboard();
  },

  async getClientList(params: { page?: number; limit?: number; sortBy?: string; sortDir?: string; search?: string }): Promise<ClientListResponse> {
    return await dashboardRepository.getClientList(params);
  },
};
