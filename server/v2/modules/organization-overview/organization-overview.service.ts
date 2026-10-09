import { organizationOverviewRepository } from "./organization-overview.repository";
import { planService } from "../plan/plan.service";
import type {
  OrganizationOverviewStats,
  AgentPerformanceRange,
  AgentsPerformanceResponse,
  BranchesPerformanceResponse,
} from "./organization-overview.types";
import type { Scope } from "../../utils/scope";
import { branchService } from "../branch/branch.service";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? scope.orgId || null : scope.orgId || null;
}

export const organizationOverviewService = {
  async getStats(scope: Scope, branchId?: string): Promise<OrganizationOverviewStats> {
    const orgId = effectiveOrgId(scope);
    if (branchId) await branchService.assertBranchInOrg(branchId, orgId);
    const core = await organizationOverviewRepository.getStats(orgId, branchId);
    const plan = orgId ? await planService.getOrgPlan(orgId) : null;

    if (plan?.code === "starter") {
      const { branchLeaderboard: _drop, ...rest } = core;
      return { kind: "single-branch", ...rest };
    }
    return { kind: "multi-branch", ...core };
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
    return organizationOverviewRepository.getBranchesPerformance(orgId, range, from, to, branchId);
  },
};
