export type LeadSource =
  | "SHOP"
  | "FACEBOOK"
  | "WHATSAPP"
  | "INSTAGRAM"
  | "PHONE_ENQUIRY"
  | "UNKNOWN";

export interface ReportFilters {
  from?: string;
  to?: string;
  branchId?: string;
  agentId?: string;
  leadSource?: string;
}

export interface SalesTotals {
  commission: number;
  bookings: number;
  avgCommission: number;
  distinctClients: number;
}

export interface SalesMonthBucket {
  month: string;
  commission: number;
  bookings: number;
}

export interface SalesByLeadSource {
  source: LeadSource;
  commission: number;
  bookings: number;
}

export interface SalesReport {
  range: { from: string; to: string };
  totals: SalesTotals;
  prior: SalesTotals;
  byMonth: SalesMonthBucket[];
  byLeadSource: SalesByLeadSource[];
}

export interface AgentPerformanceRow {
  id: string;
  name: string;
  commission: number;
  bookings: number;
  quotes: number;
  conversionPct: number;
  avgCommission: number;
}

export interface AgentPerformanceReport {
  range: { from: string; to: string };
  totals: { commission: number; bookings: number; quotes: number };
  rows: AgentPerformanceRow[];
}

export interface LeadSourceRow {
  source: LeadSource;
  enquiries: number;
  quotes: number;
  bookings: number;
  commission: number;
  quoteRatePct: number;
  bookRatePct: number;
}

export interface LeadSourceReport {
  range: { from: string; to: string };
  rows: LeadSourceRow[];
}

export interface TargetMonthRow {
  year: number;
  month: number;
  target: number;
  actual: number;
  attainmentPct: number;
}

export interface TargetAgentRow {
  id: string;
  name: string;
  target: number;
  actual: number;
  attainmentPct: number;
}

export interface TargetsVsActualsReport {
  year: number;
  shop: TargetMonthRow[];
  agents: TargetAgentRow[];
}
