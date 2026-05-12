import { reportsRepository } from "./reports.repository";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type {
  SalesReport,
  AgentPerformanceReport,
  LeadSourceReport,
  TargetsVsActualsReport,
  ReportFilters,
} from "./reports.types";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : scope.orgId || null;
}

const LEAD_SOURCE_VALUES = new Set([
  "SHOP",
  "FACEBOOK",
  "WHATSAPP",
  "INSTAGRAM",
  "PHONE_ENQUIRY",
]);

/**
 * Resolves the from/to window:
 *   - Both provided → use as-is (validates ordering).
 *   - Neither → last 30 days ending today.
 *   - Only one → AppError.
 * Date strings are expected in ISO YYYY-MM-DD; missing zone is treated as UTC midnight.
 */
function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  if (!from && !to) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: end };
  }
  if (!from || !to) throw new AppError("Both 'from' and 'to' are required", 400);

  const f = new Date(from);
  const t = new Date(to);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) {
    throw new AppError("Invalid date format. Use YYYY-MM-DD.", 400);
  }
  if (f > t) throw new AppError("'from' must be on or before 'to'", 400);

  f.setHours(0, 0, 0, 0);
  t.setHours(23, 59, 59, 999);
  return { from: f, to: t };
}

function resolveScope(scope: Scope, branchIdFilter?: string) {
  return {
    orgId: effectiveOrgId(scope),
    branchId: scope.branchId ?? branchIdFilter ?? null,
  };
}

function normalizeLeadSource(value?: string): string | undefined {
  if (!value) return undefined;
  return LEAD_SOURCE_VALUES.has(value) ? value : undefined;
}

export const reportsService = {
  async getSales(scope: Scope, filters: ReportFilters): Promise<SalesReport> {
    const range = resolveRange(filters.from, filters.to);
    const s = resolveScope(scope, filters.branchId);
    return reportsRepository.getSales({
      ...s,
      ...range,
      agentId: filters.agentId,
      leadSource: normalizeLeadSource(filters.leadSource),
    });
  },

  async getAgentPerformance(scope: Scope, filters: ReportFilters): Promise<AgentPerformanceReport> {
    const range = resolveRange(filters.from, filters.to);
    const s = resolveScope(scope, filters.branchId);
    return reportsRepository.getAgentPerformance({
      ...s,
      ...range,
      leadSource: normalizeLeadSource(filters.leadSource),
    });
  },

  async getLeadSource(scope: Scope, filters: ReportFilters): Promise<LeadSourceReport> {
    const range = resolveRange(filters.from, filters.to);
    const s = resolveScope(scope, filters.branchId);
    return reportsRepository.getLeadSource({ ...s, ...range });
  },

  async getTargetsVsActuals(scope: Scope, year: number, branchId?: string): Promise<TargetsVsActualsReport> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new AppError("'year' must be a 4-digit year", 400);
    }
    const s = resolveScope(scope, branchId);
    return reportsRepository.getTargetsVsActuals(year, s);
  },
};
