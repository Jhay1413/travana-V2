import axiosClient from "@/api/client/axios-client";

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
  todayCommission: number;
  weekCommission: number;
  monthCommission: number;
  ytdCommission: number;
  monthBookingsCount: number;
  avgCommission: number;
  openQuotesValue: number;
  openQuotesCount: number;
  activeClientsCount: number;
  monthTarget: number;
  leftToTarget: number;
  percentToTarget: number;
  currentMonthName: string;
}

export type AgentPerformanceRange = "day" | "week" | "month" | "custom";

export interface AgentPerformanceRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  today: number;
  week: number;
  month: number;
  rangeBookings: number;
  rangeCommission: number;
  avgPerBooking: number;
  target: number;
  achievedPercent: number;
}

export interface AgentsPerformanceResponse {
  range: AgentPerformanceRange;
  from: string;
  to: string;
  rows: AgentPerformanceRow[];
}

export interface AgentsPerformanceParams {
  range: AgentPerformanceRange;
  from?: string;
  to?: string;
}

export interface BranchOverviewFunnel {
  enquiries: number;
  quotes: number;
  bookings: number;
  conversionRate: number;
}

export interface BranchOverviewTrendPoint {
  month: string;
  commission: number;
  bookings: number;
  target: number;
}

export interface BranchOverviewTopRow {
  name: string;
  bookings: number;
  commission: number;
}

export interface TourOperatorBreakdownRow {
  id: string;
  name: string;
  bookings: number;
  commission: number;
  revenue: number;
}

export interface BranchOverviewTeamRow {
  id: string;
  name: string;
  bookings: number;
  commission: number;
  quotes: number;
}

export interface BranchOverviewAttentionItem {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
}

export interface BranchOverviewAttention {
  upcomingDepartures7d: number;
  upcomingDepartures30d: number;
  staleQuotes: number;
  openTickets: number;
  overdueTasks: number;
  recentTickets: BranchOverviewAttentionItem[];
  recentTasks: BranchOverviewAttentionItem[];
}

export interface BranchOverviewStats {
  branch: BranchSummary | null;
  kpis: BranchOverviewKpis;
  funnel: BranchOverviewFunnel;
  trend: BranchOverviewTrendPoint[];
  topDestinations: BranchOverviewTopRow[];
  topResorts: BranchOverviewTopRow[];
  topTourOperators: BranchOverviewTopRow[];
  tourOperatorBreakdown: TourOperatorBreakdownRow[];
  teamLeaderboard: BranchOverviewTeamRow[];
  attention: BranchOverviewAttention;
}

export const branchOverviewApi = {
  getStats: async (branchId?: string): Promise<BranchOverviewStats> => {
    const { data } = await axiosClient.get<{ data: BranchOverviewStats }>(
      "/api/v2/branch-overview/stats",
      { params: branchId ? { branchId } : undefined },
    );
    return data?.data ?? (data as unknown as BranchOverviewStats);
  },
  getAgentsPerformance: async (
    params: AgentsPerformanceParams,
    branchId?: string,
  ): Promise<AgentsPerformanceResponse> => {
    const { data } = await axiosClient.get<{ data: AgentsPerformanceResponse }>(
      "/api/v2/branch-overview/agents-performance",
      { params: branchId ? { ...params, branchId } : params },
    );
    return data?.data ?? (data as unknown as AgentsPerformanceResponse);
  },
};
