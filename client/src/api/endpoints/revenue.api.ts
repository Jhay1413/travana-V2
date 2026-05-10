import axiosClient from "../client/axios-client";
import type { RevenueDashboardData, MonthBookingsData, MonthForwards } from "@/types/revenue/revenue.types";

export const revenueApi = {
  getDashboard: async (): Promise<RevenueDashboardData> => {
    const { data } = await axiosClient.get<RevenueDashboardData>("/api/v2/revenue/dashboard");
    return data;
  },

  getMonthBookings: async (year: number, month: number): Promise<MonthBookingsData> => {
    const { data } = await axiosClient.get<MonthBookingsData>(
      `/api/v2/revenue/month-bookings/${year}/${month}`
    );
    return data;
  },

  getMonthForwards: async (year: number, month: number): Promise<MonthForwards> => {
    const { data } = await axiosClient.get<MonthForwards>(
      `/api/v2/revenue/month-forwards/${year}/${month}`
    );
    return data;
  },
};
