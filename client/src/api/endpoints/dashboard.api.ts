import axiosClient from "../client/axios-client";
import type { DashboardStats } from "@/types/dashboard";

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await axiosClient.get<DashboardStats>("/api/dashboard/stats");
    return data;
  },
};
