export interface DashboardStats {
  totalClients: number;
  totalQuotes: number;
  totalRevenue: number;
  avgDealSize: number;
  totalTransactions: number;
  enquiryCount: number;
  quotedCount: number;
  bookedCount: number;
}

/** London-day boundaries (UTC instants) the agent-stats aggregation buckets by. */
export interface AgentStatsWindows {
  todayStart: Date;
  weekStart: Date;
  monthStart: Date;
  /** Exclusive end of the month window. */
  monthEnd: Date;
}
