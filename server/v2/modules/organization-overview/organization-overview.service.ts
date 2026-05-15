import { organizationOverviewRepository } from "./organization-overview.repository";
import type {
  OrganizationOverviewStats,
  AgentPerformanceRange,
  AgentsPerformanceResponse,
} from "./organization-overview.types";
import type { Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? scope.orgId || null : scope.orgId || null;
}

export const organizationOverviewService = {
  async getStats(scope: Scope): Promise<OrganizationOverviewStats> {
    return organizationOverviewRepository.getStats(effectiveOrgId(scope));
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
};
