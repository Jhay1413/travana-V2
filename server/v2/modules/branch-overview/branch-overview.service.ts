import { branchOverviewRepository } from "./branch-overview.repository";
import { AppError } from "../../utils/error-handler";
import type {
  BranchOverviewStats,
  AgentPerformanceRange,
  AgentsPerformanceResponse,
} from "./branch-overview.types";
import type { Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : scope.orgId || null;
}

/**
 * Resolve which branch the request reads stats for.
 *
 * - org_admin: may override to any branch within their org (verified).
 * - platform_admin: must pass `override` explicitly.
 * - branch users (manager / agent / homeworker): always their own branch;
 *   `override` is ignored unless it matches scope.branchId.
 *
 * Returns the resolved branchId (or null when no branch context applies,
 * e.g. an org_admin viewing the whole org with no override — kept for
 * backward compatibility with the previous behaviour).
 */
async function resolveBranchId(scope: Scope, override?: string): Promise<string | null> {
  if (scope.orgRole === "platform_admin") {
    if (!override) return null;
    return override;
  }

  if (scope.orgRole === "org_admin" && override && override !== scope.branchId) {
    const ok = await branchOverviewRepository.branchBelongsToOrg(override, scope.orgId);
    if (!ok) throw new AppError("Branch not found", 404);
    return override;
  }

  if (override && scope.branchId && override !== scope.branchId) {
    throw new AppError("Branch not found", 404);
  }

  return scope.branchId;
}

export const branchOverviewService = {
  async getStats(scope: Scope, branchOverride?: string): Promise<BranchOverviewStats> {
    const branchId = await resolveBranchId(scope, branchOverride);
    return branchOverviewRepository.getStats({
      orgId: effectiveOrgId(scope),
      branchId,
    });
  },

  async getAgentsPerformance(
    scope: Scope,
    range: AgentPerformanceRange,
    from?: Date,
    to?: Date,
    branchOverride?: string,
  ): Promise<AgentsPerformanceResponse> {
    const branchId = await resolveBranchId(scope, branchOverride);
    return branchOverviewRepository.getAgentsPerformance(
      { orgId: effectiveOrgId(scope), branchId },
      range,
      from,
      to,
    );
  },
};
