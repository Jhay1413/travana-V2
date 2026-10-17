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
  branchId: null,
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

  it("ignores a ?branchId for a branch_manager with no branch (cannot aim at a homeworker branch)", async () => {
    await reportsService.getSales(BM, { branchId: "hw-branch" });
    expect(vi.mocked(reportsRepository.getSales).mock.calls[0][0]).toMatchObject({ branchId: null });
  });

  it("honours ?branchId for an org_admin", async () => {
    await reportsService.getSales({ ...BM, orgRole: "org_admin", orgRoles: ["org_admin"] }, { branchId: "b9" });
    expect(vi.mocked(reportsRepository.getSales).mock.calls[0][0]).toMatchObject({ branchId: "b9" });
  });

  it("a branch_manager's own branch wins over the query", async () => {
    await reportsService.getAgentPerformance({ ...BM, branchId: "mine" }, { branchId: "other" });
    expect(vi.mocked(reportsRepository.getAgentPerformance).mock.calls[0][0]).toMatchObject({ branchId: "mine" });
  });
});
