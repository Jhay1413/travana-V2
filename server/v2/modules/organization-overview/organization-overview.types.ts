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
  todayUpsellCommission: number;
  weekUpsellCommission: number;
  monthUpsellCommission: number;
  ytdCommission: number;
  monthBookingsCount: number;
  todayBookingsCount: number;
  weekBookingsCount: number;
  monthSales: number;
  monthQuotesCount: number;
  weekCloseRate: number;
  prevWeekCloseRate: number;
  quoteViewsCount: number;
  quotesSentCount: number;
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
  isHomeworker: boolean;
  branches: Array<{ id: string; name: string; code: string | null }>;
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
  unlisted: { today: number; week: number; month: number; rangeBookings: number };
}

export type OverviewBranchType = "shop" | "homeworker";

export interface BranchPerformanceRow {
  id: string;
  name: string;
  code: string | null;
  branchType: OverviewBranchType;
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

/** A homeworker branch row as the repository returns it (identity only, no numbers). */
export interface HomeworkerBranchRecord {
  branchId: string;
  name: string;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  profitSharePercent: number | null;
  isActive: boolean;
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
  branchType: OverviewBranchType;
  /** Homeworker branches only; null for shop branches. */
  profitSharePercent: number | null;
  /** Homeworker branches only; null for shop branches. */
  ownerUserId: string | null;
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
  tourOperatorBreakdown: TourOperatorBreakdownRow[];
  attention: OrganizationOverviewAttention;
}

export interface OrganizationOverviewCore extends OrganizationOverviewBase {
  branchLeaderboard: OrganizationOverviewBranchRow[];
}

export interface HomeworkersOverview {
  /** One row per homeworker branch, kept separate from the shop branch leaderboard. */
  homeworkers: HomeworkerOverviewRow[];
}

export interface SingleBranchOverview extends OrganizationOverviewBase, HomeworkersOverview {
  kind: "single-branch";
}

export interface MultiBranchOverview extends OrganizationOverviewBase, HomeworkersOverview {
  kind: "multi-branch";
  branchLeaderboard: OrganizationOverviewBranchRow[];
}

export type OrganizationOverviewStats = SingleBranchOverview | MultiBranchOverview;
