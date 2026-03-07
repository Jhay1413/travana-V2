import { revenueRepository } from "../repositories/revenue.repository";
import type {
  RevenueDashboardData,
  MonthForwards,
  AgentPerformance,
  MonthBookingsData,
  BookingDetail,
} from "../types/revenue/revenue.types";

// Default monthly targets (can be made configurable later)
const DEFAULT_MONTHLY_TARGETS: Record<number, number> = {
  1: 10000, // January
  2: 10000, // February
  3: 12000, // March
  4: 12000, // April
  5: 15000, // May
  6: 15000, // June
  7: 12000, // July
  8: 10000, // August
  9: 10000, // September
  10: 12000, // October
  11: 15000, // November
  12: 12000, // December
};

export const revenueService = {
  /**
   * Get complete revenue dashboard data for the next 12 months
   */
  async getRevenueDashboard(): Promise<RevenueDashboardData> {
    const now = new Date();
    const monthlyData: MonthForwards[] = [];

    // Calculate forwards for next 12 months
    for (let i = 0; i < 12; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;

      const { totalCommission, dealCount } = await revenueRepository.getForwardsForMonth(
        year,
        month
      );

      const monthName = targetDate.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
      });
      const shortMonth = targetDate.toLocaleDateString("en-GB", { month: "short" });

      const target = DEFAULT_MONTHLY_TARGETS[month] || 10000;
      const avgDealValue = dealCount > 0 ? totalCommission / dealCount : 0;

      monthlyData.push({
        month: monthName,
        shortMonth,
        year,
        monthNumber: month,
        forwards: totalCommission,
        target,
        deals: dealCount,
        avgDealValue,
      });
    }

    // Get agent performance
    const agentData = await revenueRepository.getAgentPerformance();
    const agentPerformance: AgentPerformance[] = agentData.map((agent) => ({
      agentId: agent.agentId,
      name: `${agent.agentFirstName} ${agent.agentLastName}`,
      forwards: agent.totalCommission,
      deals: agent.dealCount,
      avgProfit: agent.dealCount > 0 ? agent.totalCommission / agent.dealCount : 0,
    }));

    // Calculate summary metrics
    const nextMonthForwards = monthlyData[0]?.forwards || 0;
    const total12MonthForwards = monthlyData.reduce((sum, m) => sum + m.forwards, 0);
    const totalDeals = monthlyData.reduce((sum, m) => sum + m.deals, 0);
    const avgDealProfit = totalDeals > 0 ? total12MonthForwards / totalDeals : 0;

    const nextMonthTarget = monthlyData[0]?.target || 10000;
    const nextMonthGap = Math.max(0, nextMonthTarget - nextMonthForwards);
    const dealsNeeded = avgDealProfit > 0 ? Math.ceil(nextMonthGap / avgDealProfit) : 0;

    return {
      nextMonthForwards,
      total12MonthForwards,
      avgDealProfit,
      nextMonthTarget,
      dealsNeeded,
      monthlyData,
      agentPerformance,
    };
  },

  /**
   * Get detailed bookings for a specific month
   */
  async getMonthBookings(year: number, month: number): Promise<MonthBookingsData> {
    const bookingsData = await revenueRepository.getBookingsForMonth(year, month);

    const targetDate = new Date(year, month - 1, 1);
    const monthName = targetDate.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });

    const bookings: BookingDetail[] = bookingsData.map((b) => ({
      bookingId: b.bookingId,
      clientName: `${b.clientFirstName} ${b.clientSurename}`,
      destination: b.title || "Unknown",
      travelDate: b.travelDate,
      commission: b.commission,
      agentId: b.agentId,
      agentName: `${b.agentFirstName} ${b.agentLastName}`,
    }));

    return {
      month: monthName,
      bookings,
    };
  },

  /**
   * Get forwards for a specific month (useful for individual queries)
   */
  async getMonthForwards(year: number, month: number): Promise<MonthForwards> {
    const { totalCommission, dealCount } = await revenueRepository.getForwardsForMonth(
      year,
      month
    );

    const targetDate = new Date(year, month - 1, 1);
    const monthName = targetDate.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    const shortMonth = targetDate.toLocaleDateString("en-GB", { month: "short" });

    const target = DEFAULT_MONTHLY_TARGETS[month] || 10000;
    const avgDealValue = dealCount > 0 ? totalCommission / dealCount : 0;

    return {
      month: monthName,
      shortMonth,
      year,
      monthNumber: month,
      forwards: totalCommission,
      target,
      deals: dealCount,
      avgDealValue,
    };
  },
};
