import { useQuery } from "@tanstack/react-query";
import { revenueApi } from "@/api/endpoints/revenue.api";
import type { RevenueDashboardData, MonthBookingsData, MonthForwards } from "@/types/revenue/revenue.types";

export const revenueKeys = {
  all: ["revenue"] as const,
  dashboard: () => [...revenueKeys.all, "dashboard"] as const,
  monthBookings: (year: number, month: number) =>
    [...revenueKeys.all, "month-bookings", year, month] as const,
  monthForwards: (year: number, month: number) =>
    [...revenueKeys.all, "month-forwards", year, month] as const,
};

export function useRevenueDashboard() {
  return useQuery<RevenueDashboardData>({
    queryKey: revenueKeys.dashboard(),
    queryFn: revenueApi.getDashboard,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMonthBookings(year: number, month: number) {
  return useQuery<MonthBookingsData>({
    queryKey: revenueKeys.monthBookings(year, month),
    queryFn: () => revenueApi.getMonthBookings(year, month),
    enabled: !!year && !!month,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMonthForwards(year: number, month: number) {
  return useQuery<MonthForwards>({
    queryKey: revenueKeys.monthForwards(year, month),
    queryFn: () => revenueApi.getMonthForwards(year, month),
    enabled: !!year && !!month,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
