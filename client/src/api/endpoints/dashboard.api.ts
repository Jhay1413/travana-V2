import axiosClient from "../client/axios-client";
import type { DashboardStats } from "@/types/dashboard";

export interface MyProfit {
  profitThisMonth: number;
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const { data } = await axiosClient.get<DashboardStats>("/api/dashboard/stats");
    return data;
  },

  getMyProfit: async (): Promise<MyProfit> => {
    const { data } = await axiosClient.get<MyProfit>("/api/dashboard/my-profit");
    return data;
  },
};
