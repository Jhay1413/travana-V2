// HTTP contract for the two endpoints added for the Admin Dashboard
// (GET /organization-overview/compare and /profit-sources).
export type ComparePeriod = "week" | "month" | "year";
export type CompareAgainst = "prev" | "year" | "two_years";

export interface CompareMeasures {
  profit: number;
  bookings: number;
  ppb: number;
  closeRate: number;
}

export interface CompareWindow {
  from: string;
  to: string;
}

export interface OrganizationOverviewCompare {
  period: ComparePeriod;
  against: CompareAgainst;
  now: CompareMeasures;
  other: CompareMeasures;
  labels: { now: string; other: string };
  windows: { now: CompareWindow; other: CompareWindow };
}

export type LeadSourceKey = "SHOP" | "FACEBOOK" | "WHATSAPP" | "INSTAGRAM" | "PHONE_ENQUIRY" | "none";

export interface ProfitSourceRow {
  source: LeadSourceKey;
  label: string;
  profit: number;
  bookings: number;
}

export interface ProfitSourcesResponse {
  month: string;
  rows: ProfitSourceRow[];
  totals: { profit: number; bookings: number };
}

export interface CompareParams {
  period: ComparePeriod;
  against: CompareAgainst;
  branchId?: string;
}
