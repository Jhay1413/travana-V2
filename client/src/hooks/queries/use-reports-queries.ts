import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/api";
import type {
  ReportFilters,
  SalesReport,
  AgentPerformanceReport,
  LeadSourceReport,
  TargetsVsActualsReport,
} from "@/api/endpoints/reports.api";

export const reportKeys = {
  all: ["reports"] as const,
  sales: (f: ReportFilters) => [...reportKeys.all, "sales", f] as const,
  agents: (f: ReportFilters) => [...reportKeys.all, "agents", f] as const,
  leadSource: (f: ReportFilters) => [...reportKeys.all, "lead-source", f] as const,
  targetsVsActuals: (year: number, branchId?: string) =>
    [...reportKeys.all, "targets-vs-actuals", year, branchId] as const,
};

function ready(f: ReportFilters): boolean {
  return Boolean(f.from && f.to);
}

export function useSalesReport(filters: ReportFilters) {
  return useQuery<SalesReport>({
    queryKey: reportKeys.sales(filters),
    queryFn: () => reportsApi.getSales(filters),
    enabled: ready(filters),
  });
}

export function useAgentPerformanceReport(filters: ReportFilters) {
  return useQuery<AgentPerformanceReport>({
    queryKey: reportKeys.agents(filters),
    queryFn: () => reportsApi.getAgents(filters),
    enabled: ready(filters),
  });
}

export function useLeadSourceReport(filters: ReportFilters) {
  return useQuery<LeadSourceReport>({
    queryKey: reportKeys.leadSource(filters),
    queryFn: () => reportsApi.getLeadSource(filters),
    enabled: ready(filters),
  });
}

export function useTargetsVsActualsReport(year: number, branchId?: string) {
  return useQuery<TargetsVsActualsReport>({
    queryKey: reportKeys.targetsVsActuals(year, branchId),
    queryFn: () => reportsApi.getTargetsVsActuals(year, branchId),
    enabled: Number.isInteger(year) && year > 2000,
  });
}
