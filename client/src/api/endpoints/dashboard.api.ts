import axiosClient from "../client/axios-client";
import type { DashboardStats } from "@/types/dashboard";

export interface MyProfit {
  profitThisMonth: number;
}

export interface AdminOverviewStats {
  todayProfit: number;
  weekProfit: number;
  monthProfit: number;
  monthBookingsCount: number;
  monthAvgBookingProfit: number;
  monthOpenQuotesValue: number;
  monthQuotesCount: number;
  agentPerformance: Array<{
    id: string;
    name: string;
    revenue: number;
    commission: number;
    bookings: number;
    quotes: number;
  }>;
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

  getAdminOverviewStats: async (): Promise<AdminOverviewStats> => {
    const { data } = await axiosClient.get<AdminOverviewStats>("/api/dashboard/admin-overview-stats");
    return data;
  },
};
