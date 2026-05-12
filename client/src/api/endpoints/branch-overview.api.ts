import axiosClient from "../client/axios-client";

export interface BranchSummary {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isDefault: boolean;
  isActive: boolean;
  memberCount: number;
}

export interface BranchOverviewKpis {
  todayProfit: number;
  weekProfit: number;
  monthProfit: number;
  ytdProfit: number;
  monthRevenue: number;
  ytdRevenue: number;
  monthBookingsCount: number;
  avgBookingValue: number;
  openQuotesValue: number;
  openQuotesCount: number;
  activeClientsCount: number;
}

export interface BranchOverviewFunnel {
  enquiries: number;
  quotes: number;
  bookings: number;
  conversionRate: number;
}

export interface BranchOverviewTrendPoint {
  month: string;
  revenue: number;
  bookings: number;
}

export interface BranchOverviewTopRow {
  name: string;
  bookings: number;
  revenue: number;
}

export interface BranchOverviewTeamRow {
  id: string;
  name: string;
  bookings: number;
  revenue: number;
  commission: number;
  quotes: number;
}

export interface BranchOverviewAttention {
  upcomingDepartures7d: number;
  upcomingDepartures30d: number;
  staleQuotes: number;
  openTickets: number;
  overdueTasks: number;
}

export interface BranchOverviewStats {
  branch: BranchSummary | null;
  kpis: BranchOverviewKpis;
  funnel: BranchOverviewFunnel;
  trend: BranchOverviewTrendPoint[];
  topDestinations: BranchOverviewTopRow[];
  topResorts: BranchOverviewTopRow[];
  teamLeaderboard: BranchOverviewTeamRow[];
  attention: BranchOverviewAttention;
}

export const branchOverviewApi = {
  getStats: async (): Promise<BranchOverviewStats> => {
    const { data } = await axiosClient.get<{ data: BranchOverviewStats }>(
      "/api/v2/branch-overview/stats",
    );
    return data?.data ?? (data as unknown as BranchOverviewStats);
  },
};
