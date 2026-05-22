import axiosClient from "../client/axios-client";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan: string | null;
  logoUrl: string | null;
  isActive: boolean;
  seatLimit: number | null;
  branchLimit: number | null;
  createdAt: string | null;
  branchCount: number;
  activeBranchCount: number;
  memberCount: number;
  clientCount: number;
}

export interface OrganizationOverviewKpis {
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
  firstName: string;
  avatarUrl: string | null;
  today: number;
  week: number;
  month: number;
  rangeBookings: number;
  rangeCommission: number;
  rangeSales: number;
  rangeQuotes: number;
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

export interface BranchPerformanceRow {
  id: string;
  name: string;
  code: string | null;
  today: number;
  week: number;
  month: number;
  rangeBookings: number;
  rangeCommission: number;
  rangeSales: number;
  rangeQuotes: number;
  avgPerBooking: number;
  target: number;
  achievedPercent: number;
}

export interface BranchesPerformanceResponse {
  range: AgentPerformanceRange;
  from: string;
  to: string;
  rows: BranchPerformanceRow[];
}

export type BranchesPerformanceParams = AgentsPerformanceParams;

export interface OrganizationOverviewFunnel {
  enquiries: number;
  quotes: number;
  bookings: number;
  conversionRate: number;
}

export interface OrganizationOverviewTrendPoint {
  month: string;
  commission: number;
  bookings: number;
  target: number;
}

export interface OrganizationOverviewTopRow {
  name: string;
  bookings: number;
  commission: number;
}

export interface OrganizationOverviewBranchRow {
  id: string;
  name: string;
  code: string | null;
  bookings: number;
  commission: number;
  quotes: number;
  monthTarget: number;
  percentToTarget: number;
  memberCount: number;
}

export interface OrganizationOverviewAttentionItem {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  dueDate: string | null;
}

export interface OrganizationOverviewAttention {
  upcomingDepartures7d: number;
  upcomingDepartures30d: number;
  staleQuotes: number;
  openTickets: number;
  overdueTasks: number;
  recentTickets: OrganizationOverviewAttentionItem[];
  recentTasks: OrganizationOverviewAttentionItem[];
}

interface OrganizationOverviewBase {
  organization: OrganizationSummary | null;
  kpis: OrganizationOverviewKpis;
  funnel: OrganizationOverviewFunnel;
  trend: OrganizationOverviewTrendPoint[];
  topDestinations: OrganizationOverviewTopRow[];
  topResorts: OrganizationOverviewTopRow[];
  topTourOperators: OrganizationOverviewTopRow[];
  attention: OrganizationOverviewAttention;
}

export interface SingleBranchOverview extends OrganizationOverviewBase {
  kind: "single-branch";
}

export interface MultiBranchOverview extends OrganizationOverviewBase {
  kind: "multi-branch";
  branchLeaderboard: OrganizationOverviewBranchRow[];
}

export type OrganizationOverviewStats = SingleBranchOverview | MultiBranchOverview;

export const organizationOverviewApi = {
  getStats: async (): Promise<OrganizationOverviewStats> => {
    const { data } = await axiosClient.get<{ data: OrganizationOverviewStats }>(
      "/api/v2/organization-overview/stats",
    );
    return data?.data ?? (data as unknown as OrganizationOverviewStats);
  },
  getAgentsPerformance: async (
    params: AgentsPerformanceParams,
  ): Promise<AgentsPerformanceResponse> => {
    const { data } = await axiosClient.get<{ data: AgentsPerformanceResponse }>(
      "/api/v2/organization-overview/agents-performance",
      { params },
    );
    return data?.data ?? (data as unknown as AgentsPerformanceResponse);
  },
  getBranchesPerformance: async (
    params: BranchesPerformanceParams,
  ): Promise<BranchesPerformanceResponse> => {
    const { data } = await axiosClient.get<{ data: BranchesPerformanceResponse }>(
      "/api/v2/organization-overview/branches-performance",
      { params },
    );
    return data?.data ?? (data as unknown as BranchesPerformanceResponse);
  },
};
