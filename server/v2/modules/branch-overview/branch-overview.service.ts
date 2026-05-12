import { branchOverviewRepository } from "./branch-overview.repository";
import type { BranchOverviewStats } from "./branch-overview.types";
import type { Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : scope.orgId || null;
}

export const branchOverviewService = {
  async getStats(scope: Scope): Promise<BranchOverviewStats> {
    return branchOverviewRepository.getStats({
      orgId: effectiveOrgId(scope),
      branchId: scope.branchId,
    });
  },
};
