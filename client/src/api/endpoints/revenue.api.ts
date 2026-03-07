import axiosClient from "../client/axios-client";
import type { RevenueDashboardData, MonthBookingsData, MonthForwards } from "@/types/revenue/revenue.types";

export const revenueApi = {
  getDashboard: async (): Promise<RevenueDashboardData> => {
    const { data } = await axiosClient.get<RevenueDashboardData>("/api/revenue/dashboard");
    return data;
  },

  getMonthBookings: async (year: number, month: number): Promise<MonthBookingsData> => {
    const { data } = await axiosClient.get<MonthBookingsData>(
      `/api/revenue/month-bookings/${year}/${month}`
    );
    return data;
  },

  getMonthForwards: async (year: number, month: number): Promise<MonthForwards> => {
    const { data } = await axiosClient.get<MonthForwards>(
      `/api/revenue/month-forwards/${year}/${month}`
    );
    return data;
  },
};
