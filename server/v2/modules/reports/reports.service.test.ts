import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./reports.repository", () => ({
  reportsRepository: {
    getSales: vi.fn().mockResolvedValue({}),
    getAgentPerformance: vi.fn().mockResolvedValue({}),
    getLeadSource: vi.fn().mockResolvedValue({}),
    getTargetsVsActuals: vi.fn().mockResolvedValue({}),
  },
}));

import { reportsService } from "./reports.service";
import { reportsRepository } from "./reports.repository";
import type { Scope } from "../../utils/scope";

const BM: Scope = {
  orgId: "org1",
  branchId: "mine",
  orgRole: "branch_manager",
  orgRoles: ["branch_manager"],
  userId: "u1",
  branchType: null,
  ownsHomeworkerBranch: false,
};

beforeEach(() => vi.clearAllMocks());

describe("reportsService branch scoping", () => {
  it("passes the caller scope through as partitionScope", async () => {
    await reportsService.getSales(BM, {});
    expect(vi.mocked(reportsRepository.getSales).mock.calls[0][0]).toMatchObject({ partitionScope: BM });
  });

  it("a branch_manager or agent with no shop gets 403 on every report (never an org-wide one), whatever ?branchId says", async () => {
    for (const orgRole of ["branch_manager", "agent"] as const) {
      const noShop: Scope = { ...BM, branchId: null, orgRole, orgRoles: [orgRole] };
      await expect(reportsService.getSales(noShop, { branchId: "hw-branch" })).rejects.toMatchObject({ statusCode: 403 });
      await expect(reportsService.getAgentPerformance(noShop, {})).rejects.toMatchObject({ statusCode: 403 });
      await expect(reportsService.getLeadSource(noShop, {})).rejects.toMatchObject({ statusCode: 403 });
      await expect(reportsService.getTargetsVsActuals(noShop, 2026)).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(reportsRepository.getSales).not.toHaveBeenCalled();
  });

  it("an org_admin with no branch still gets the org-wide report", async () => {
    await reportsService.getSales({ ...BM, branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"] }, {});
    expect(vi.mocked(reportsRepository.getSales).mock.calls[0][0]).toMatchObject({ branchId: null, orgId: "org1" });
  });

  it("honours ?branchId for an org_admin", async () => {
    await reportsService.getSales({ ...BM, branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"] }, { branchId: "b9" });
    expect(vi.mocked(reportsRepository.getSales).mock.calls[0][0]).toMatchObject({ branchId: "b9" });
  });

  it("a branch_manager's own branch wins over the query", async () => {
    await reportsService.getAgentPerformance(BM, { branchId: "other" });
    expect(vi.mocked(reportsRepository.getAgentPerformance).mock.calls[0][0]).toMatchObject({ branchId: "mine" });
  });
});
