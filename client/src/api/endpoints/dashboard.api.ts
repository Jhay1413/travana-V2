import axiosClient from "../client/axios-client";
import type { DashboardStats, ClientDashboardKPIs, RebookingDashboard, VIPDashboard, BehaviourDashboard, ClientListResponse } from "@/types/dashboard";

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await axiosClient.get<DashboardStats>("/api/dashboard/stats");
    return data;
  },

  getClientKPIs: async (): Promise<ClientDashboardKPIs> => {
    const { data } = await axiosClient.get<ClientDashboardKPIs>("/api/dashboard/clients/kpis");
    return data;
  },

  getRebooking: async (): Promise<RebookingDashboard> => {
    const { data } = await axiosClient.get<RebookingDashboard>("/api/dashboard/clients/rebooking");
    return data;
  },

  getVIP: async (): Promise<VIPDashboard> => {
    const { data } = await axiosClient.get<VIPDashboard>("/api/dashboard/clients/vip");
    return data;
  },

  getBehaviour: async (): Promise<BehaviourDashboard> => {
    const { data } = await axiosClient.get<BehaviourDashboard>("/api/dashboard/clients/behaviour");
    return data;
  },

  getClientList: async (params?: { page?: number; limit?: number; sortBy?: string; sortDir?: string; search?: string }): Promise<ClientListResponse> => {
    const { data } = await axiosClient.get<ClientListResponse>("/api/dashboard/clients/list", { params });
    return data;
  },
};
