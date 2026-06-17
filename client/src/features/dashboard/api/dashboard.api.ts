import axiosClient from "@/api/client/axios-client";
import type { DashboardStats } from "@/features/dashboard/types";

export interface MyProfit {
  profitThisMonth: number;
}

export interface AgentStats {
  todayProfit: number;
  weekProfit: number;
  monthProfit: number;
  bookingsCount: number;
  avgBookingValue: number;
  totalOpenQuotesValue: number;
  quotesCount: number;
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
    const { data } = await axiosClient.get<DashboardStats>("/api/v2/dashboard/stats");
    return data;
  },

  getMyProfit: async (): Promise<MyProfit> => {
    const { data } = await axiosClient.get<MyProfit>("/api/v2/dashboard/my-profit");
    return data;
  },

  getAdminOverviewStats: async (): Promise<AdminOverviewStats> => {
    const { data } = await axiosClient.get<AdminOverviewStats>("/api/v2/dashboard/admin-overview-stats");
    return data;
  },

  getAgentStats: async (): Promise<AgentStats> => {
    const { data } = await axiosClient.get<{ data: AgentStats }>("/api/v2/dashboard/agent-stats");
    return data?.data ?? (data as unknown as AgentStats);
  },
};
