import { organizationOverviewRepository } from "./organization-overview.repository";
import { planService } from "../plan/plan.service";
import type {
  OrganizationOverviewStats,
  AgentPerformanceRange,
  AgentsPerformanceResponse,
  BranchesPerformanceResponse,
  AgentPerformanceRow,
  HomeworkerBranchRecord,
  HomeworkerOverviewRow,
  CompareAgainst,
  CompareMeasures,
  CompareWindowTotals,
  ComparePeriod,
  OrganizationOverviewCompare,
  ProfitSourceRow,
  ProfitSourcesResponse,
} from "./organization-overview.types";
import type { Scope } from "../../utils/scope";
import { branchService } from "../branch/branch.service";
import { AppError } from "../../utils/error-handler";
import { ukMonthEnd, ukStartOfMonth, ukYearMonth } from "../../utils/london-dates";
import { compareLabels, compareWindows } from "./organization-overview-windows";
import { closeRatePercent, leadSourceLabel, perBooking } from "./organization-overview.math";

/**
 * The org every figure is scoped to. Fails closed: a caller with no org context
 * (a platform admin who has not picked an organisation) must never fall through
 * to an unscoped, cross-org read.
 */
function effectiveOrgId(scope: Scope): string {
  if (!scope.orgId) throw new AppError("Select an organisation first", 403);
  return scope.orgId;
}

function toMeasures(t: CompareWindowTotals): CompareMeasures {
  return {
    profit: t.profit,
    bookings: t.bookings,
    ppb: perBooking(t.profit, t.bookings),
    closeRate: closeRatePercent(t.bookings, t.quotedDeals),
  };
}

function buildProfitSourceRows(
  totals: Array<{ source: string; profit: number; bookings: number }>,
): ProfitSourceRow[] {
  return totals
    .filter((t) => t.profit !== 0 || t.bookings !== 0)
    .map((t): ProfitSourceRow => ({
      source: t.source,
      label: leadSourceLabel(t.source),
      profit: t.profit,
      bookings: t.bookings,
    }))
    .sort((a, b) => b.profit - a.profit || a.label.localeCompare(b.label));
}

/**
 * One row per homeworker branch. The branch is only the grouping key: the numbers
 * come from the owner's agent-performance row; an owner with no row (archived,
 * suspended, no sales) reports zeros rather than disappearing.
 */
function isShopBranch(row: { branchType: string }): boolean {
  return row.branchType !== "homeworker";
}

export function buildHomeworkerRows(
  records: HomeworkerBranchRecord[],
  agentRows: AgentPerformanceRow[],
): HomeworkerOverviewRow[] {
  const byUser = new Map(agentRows.map((r) => [r.id, r] as const));
  const rows = records.map((rec): HomeworkerOverviewRow => {
    const perf = rec.ownerUserId ? byUser.get(rec.ownerUserId) : undefined;
    return {
      branchId: rec.branchId,
      name: rec.name,
      ownerUserId: rec.ownerUserId,
      ownerName: rec.ownerName,
      ownerAvatarUrl: rec.ownerAvatarUrl,
      profitSharePercent: rec.profitSharePercent,
      status: rec.isActive ? "active" : "archived",
      today: perf?.today ?? 0,
      week: perf?.week ?? 0,
      month: perf?.month ?? 0,
      rangeBookings: perf?.rangeBookings ?? 0,
      avgPerBooking: perf?.avgPerBooking ?? 0,
      target: perf?.target ?? 0,
      achievedPercent: perf?.achievedPercent ?? 0,
    };
  });
  // Active first, then best month; archived sink to the bottom.
  rows.sort(
    (a, b) =>
      Number(b.status === "active") - Number(a.status === "active") ||
      b.month - a.month ||
      a.name.localeCompare(b.name),
  );
  return rows;
}

export const organizationOverviewService = {
  async getStats(scope: Scope, branchId?: string): Promise<OrganizationOverviewStats> {
    const orgId = effectiveOrgId(scope);
    if (branchId) await branchService.assertBranchInOrg(branchId, orgId);
    const [rawCore, homeworkerRecords] = await Promise.all([
      organizationOverviewRepository.getStats(orgId, branchId),
      organizationOverviewRepository.getHomeworkerBranches(orgId, branchId),
    ]);
    // Shop lists are shop-only; homeworker branches appear only in homeworkers[].
    const core = { ...rawCore, branchLeaderboard: rawCore.branchLeaderboard.filter(isShopBranch) };
    const homeworkerPerformance =
      homeworkerRecords.length > 0
        ? await organizationOverviewRepository.getAgentsPerformance(orgId, "month", undefined, undefined, branchId, {
            includeOpenDeals: false,
          })
        : null;
    const homeworkers = buildHomeworkerRows(homeworkerRecords, homeworkerPerformance?.rows ?? []);
    const plan = await planService.getOrgPlan(orgId);

    if (plan?.code === "starter") {
      const { branchLeaderboard: _drop, ...rest } = core;
      return { kind: "single-branch", ...rest, homeworkers };
    }
    return { kind: "multi-branch", ...core, homeworkers };
  },

  async getAgentsPerformance(
    scope: Scope,
    range: AgentPerformanceRange,
    from?: Date,
    to?: Date,
    branchId?: string,
  ): Promise<AgentsPerformanceResponse> {
    const orgId = effectiveOrgId(scope);
    if (branchId) await branchService.assertBranchInOrg(branchId, orgId);
    return organizationOverviewRepository.getAgentsPerformance(orgId, range, from, to, branchId);
  },

  async getBranchesPerformance(
    scope: Scope,
    range: AgentPerformanceRange,
    from?: Date,
    to?: Date,
    branchId?: string,
  ): Promise<BranchesPerformanceResponse> {
    const orgId = effectiveOrgId(scope);
    if (branchId) await branchService.assertBranchInOrg(branchId, orgId);
    const result = await organizationOverviewRepository.getBranchesPerformance(orgId, range, from, to, branchId);
    return { ...result, rows: result.rows.filter(isShopBranch) };
  },

  async getCompare(
    scope: Scope,
    period: ComparePeriod,
    against: CompareAgainst,
    branchId?: string,
  ): Promise<OrganizationOverviewCompare> {
    const orgId = effectiveOrgId(scope);
    if (branchId) await branchService.assertBranchInOrg(branchId, orgId);
    const windows = compareWindows(period, against);
    const totals = await organizationOverviewRepository.getCompareTotals(
      orgId,
      { now: windows.now, other: windows.other },
      branchId,
    );
    return {
      period,
      against: windows.against,
      now: toMeasures(totals.now),
      other: toMeasures(totals.other),
      labels: compareLabels(period, windows.against),
      windows: {
        now: { from: windows.now.from.toISOString(), to: windows.now.to.toISOString() },
        other: { from: windows.other.from.toISOString(), to: windows.other.to.toISOString() },
      },
    };
  },

  async getProfitSources(scope: Scope, branchId?: string): Promise<ProfitSourcesResponse> {
    const orgId = effectiveOrgId(scope);
    if (branchId) await branchService.assertBranchInOrg(branchId, orgId);
    const now = new Date();
    const monthStart = ukStartOfMonth(now);
    const monthEnd = ukMonthEnd(now);
    const totals = await organizationOverviewRepository.getProfitSourceTotals(orgId, monthStart, monthEnd, branchId);
    const rows = buildProfitSourceRows(totals);
    const { year, month } = ukYearMonth(now);
    return {
      month: `${year}-${String(month).padStart(2, "0")}`,
      rows,
      totals: {
        profit: rows.reduce((sum, r) => sum + r.profit, 0),
        bookings: rows.reduce((sum, r) => sum + r.bookings, 0),
      },
    };
  },
};
