import axiosClient from "@/api/client/axios-client";
import { ORGANIZATION_OVERVIEW_ENDPOINTS } from "@/api/endpoints";

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
  /**
   * Average profit per booking: this month's commission (incl. upsells) divided
   * by this month's bookings. The field name is kept for compatibility.
   */
  avgCommission: number;
  openQuotesValue: number;
  openQuotesCount: number;
  activeClientsCount: number;
  monthTarget: number;
  leftToTarget: number;
  percentToTarget: number;
  currentMonthName: string;
  todayBookingsCount: number;
  weekBookingsCount: number;
  monthSales: number;
  monthQuotesCount: number;
  weekCloseRate: number;
  prevWeekCloseRate: number;
  quoteViewsCount: number;
  quotesSentCount: number;
  todayUpsellCommission: number;
  weekUpsellCommission: number;
  monthUpsellCommission: number;
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
  /** Profit incl. upsells / bookings in the range. Optional until the server ships it. */
  ppb?: number;
  /** Distinct active deals with at least one open quote. Optional until the server ships it. */
  openDeals?: number;
  target: number;
  achievedPercent: number;
  isHomeworker: boolean;
  /** Present when the server tags the row's branch type; isHomeworker is the fallback. */
  branchType?: OverviewBranchType;
  branches: Array<{ id: string; name: string; code: string | null }>;
}

export interface AgentsPerformanceUnlisted {
  today: number;
  week: number;
  month: number;
  rangeBookings: number;
}

export interface AgentsPerformanceResponse {
  range: AgentPerformanceRange;
  from: string;
  to: string;
  rows: AgentPerformanceRow[];
  unlisted?: AgentsPerformanceUnlisted;
}

export interface AgentsPerformanceParams {
  range: AgentPerformanceRange;
  from?: string;
  to?: string;
  /** Narrow every figure to one branch. Omit for the whole organisation. */
  branchId?: string;
}

export interface OverviewStatsParams {
  branchId?: string;
}

export type OverviewBranchType = "shop" | "homeworker";

export interface BranchPerformanceRow {
  id: string;
  name: string;
  code: string | null;
  /** Optional so older payloads without the field still type-check; treated as "shop". */
  branchType?: OverviewBranchType;
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

export interface TourOperatorBreakdownRow {
  id: string;
  name: string;
  bookings: number;
  commission: number;
  revenue: number;
}

export interface OrganizationOverviewBranchRow {
  id: string;
  name: string;
  code: string | null;
  branchType?: OverviewBranchType;
  profitSharePercent?: number | null;
  ownerUserId?: string | null;
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

export interface HomeworkerOverviewRow {
  branchId: string;
  name: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  profitSharePercent: number | null;
  status: "active" | "archived";
  today: number;
  week: number;
  month: number;
  rangeBookings: number;
  avgPerBooking: number;
  target: number;
  achievedPercent: number;
}

interface OrganizationOverviewBase {
  organization: OrganizationSummary | null;
  kpis: OrganizationOverviewKpis;
  funnel: OrganizationOverviewFunnel;
  trend: OrganizationOverviewTrendPoint[];
  topDestinations: OrganizationOverviewTopRow[];
  topResorts: OrganizationOverviewTopRow[];
  topTourOperators: OrganizationOverviewTopRow[];
  tourOperatorBreakdown: TourOperatorBreakdownRow[];
  attention: OrganizationOverviewAttention;
}

interface HomeworkersOverview {
  /** Optional: absent on servers that predate the homeworker redesign. */
  homeworkers?: HomeworkerOverviewRow[];
}

export interface SingleBranchOverview extends OrganizationOverviewBase, HomeworkersOverview {
  kind: "single-branch";
}

export interface MultiBranchOverview extends OrganizationOverviewBase, HomeworkersOverview {
  kind: "multi-branch";
  branchLeaderboard: OrganizationOverviewBranchRow[];
}

export type OrganizationOverviewStats = SingleBranchOverview | MultiBranchOverview;

export const organizationOverviewApi = {
  getStats: async (params?: OverviewStatsParams): Promise<OrganizationOverviewStats> => {
    const { data } = await axiosClient.get<{ data: OrganizationOverviewStats }>(
      ORGANIZATION_OVERVIEW_ENDPOINTS.stats,
      { params: params?.branchId ? { branchId: params.branchId } : undefined },
    );
    return data?.data ?? (data as unknown as OrganizationOverviewStats);
  },
  getAgentsPerformance: async (
    params: AgentsPerformanceParams,
  ): Promise<AgentsPerformanceResponse> => {
    const { data } = await axiosClient.get<{ data: AgentsPerformanceResponse }>(
      ORGANIZATION_OVERVIEW_ENDPOINTS.agentsPerformance,
      { params },
    );
    return data?.data ?? (data as unknown as AgentsPerformanceResponse);
  },
  getBranchesPerformance: async (
    params: BranchesPerformanceParams,
  ): Promise<BranchesPerformanceResponse> => {
    const { data } = await axiosClient.get<{ data: BranchesPerformanceResponse }>(
      ORGANIZATION_OVERVIEW_ENDPOINTS.branchesPerformance,
      { params },
    );
    return data?.data ?? (data as unknown as BranchesPerformanceResponse);
  },
};
