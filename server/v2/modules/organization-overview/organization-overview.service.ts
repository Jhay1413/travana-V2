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
} from "./organization-overview.types";
import type { Scope } from "../../utils/scope";
import { branchService } from "../branch/branch.service";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? scope.orgId || null : scope.orgId || null;
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
        ? await organizationOverviewRepository.getAgentsPerformance(orgId, "month", undefined, undefined, branchId)
        : null;
    const homeworkers = buildHomeworkerRows(homeworkerRecords, homeworkerPerformance?.rows ?? []);
    const plan = orgId ? await planService.getOrgPlan(orgId) : null;

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
};
