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
}

export interface BranchOverviewTopRow {
  name: string;
  bookings: number;
  commission: number;
}

export interface BranchOverviewTeamRow {
  id: string;
  name: string;
  bookings: number;
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
