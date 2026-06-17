import axiosClient from "@/api/client/axios-client";

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

function buildParams(filters: ReportFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.branchId) params.set("branchId", filters.branchId);
  if (filters.agentId) params.set("agentId", filters.agentId);
  if (filters.leadSource) params.set("leadSource", filters.leadSource);
  return params;
}

async function fetchReport<T>(path: string, filters: ReportFilters): Promise<T> {
  const qs = buildParams(filters).toString();
  const url = `/api/v2/reports/${path}${qs ? `?${qs}` : ""}`;
  const { data } = await axiosClient.get<{ data: T }>(url);
  return data?.data ?? (data as unknown as T);
}

export const reportsApi = {
  getSales: (filters: ReportFilters) => fetchReport<SalesReport>("sales", filters),
  getAgents: (filters: ReportFilters) => fetchReport<AgentPerformanceReport>("agents", filters),
  getLeadSource: (filters: ReportFilters) => fetchReport<LeadSourceReport>("lead-source", filters),
  getTargetsVsActuals: async (year: number, branchId?: string): Promise<TargetsVsActualsReport> => {
    const params = new URLSearchParams({ year: String(year) });
    if (branchId) params.set("branchId", branchId);
    const { data } = await axiosClient.get<{ data: TargetsVsActualsReport }>(
      `/api/v2/reports/targets-vs-actuals?${params.toString()}`,
    );
    return data?.data ?? (data as unknown as TargetsVsActualsReport);
  },
};
