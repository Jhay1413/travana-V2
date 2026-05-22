import { organizationOverviewRepository } from "./organization-overview.repository";
import { planService } from "../plan/plan.service";
import type {
  OrganizationOverviewStats,
  AgentPerformanceRange,
  AgentsPerformanceResponse,
  BranchesPerformanceResponse,
} from "./organization-overview.types";
import type { Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? scope.orgId || null : scope.orgId || null;
}

export const organizationOverviewService = {
  async getStats(scope: Scope): Promise<OrganizationOverviewStats> {
    const orgId = effectiveOrgId(scope);
    const core = await organizationOverviewRepository.getStats(orgId);
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
  ): Promise<AgentsPerformanceResponse> {
    return organizationOverviewRepository.getAgentsPerformance(
      effectiveOrgId(scope),
      range,
      from,
      to,
    );
  },

  async getBranchesPerformance(
    scope: Scope,
    range: AgentPerformanceRange,
    from?: Date,
    to?: Date,
  ): Promise<BranchesPerformanceResponse> {
    return organizationOverviewRepository.getBranchesPerformance(
      effectiveOrgId(scope),
      range,
      from,
      to,
    );
  },
};
