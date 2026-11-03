import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./branch-overview.repository", () => ({
  branchOverviewRepository: {
    branchBelongsToOrg: vi.fn(),
    getStats: vi.fn(),
    getAgentsPerformance: vi.fn(),
  },
}));

import { branchOverviewService } from "./branch-overview.service";
import { branchOverviewRepository } from "./branch-overview.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

const homeworker = {
  orgRole: "homeworker", orgRoles: ["homeworker"], orgId: "o1", branchId: "hwb", userId: "hw1",
  branchType: "homeworker", ownsHomeworkerBranch: true,
} as never;
const manager = { orgRole: "branch_manager", orgRoles: ["branch_manager"], orgId: "o1", branchId: "b1", userId: "m1", branchType: "shop" } as never;
const admin = { orgRole: "org_admin", orgRoles: ["org_admin"], orgId: "o1", branchId: null, userId: "a1" } as never;

describe("branchOverviewService - branch resolution", () => {
  it("a homeworker reads stats for their own homeworker branch", async () => {
    await branchOverviewService.getStats(homeworker);

    expect(branchOverviewRepository.getStats).toHaveBeenCalledWith(expect.objectContaining({ orgId: "o1", branchId: "hwb" }));
  });

  it("a homeworker may pass their own branch id explicitly", async () => {
    await branchOverviewService.getStats(homeworker, "hwb");

    expect(branchOverviewRepository.getStats).toHaveBeenCalledWith(expect.objectContaining({ orgId: "o1", branchId: "hwb" }));
  });

  it("a homeworker cannot override to another branch (404)", async () => {
    await expect(branchOverviewService.getStats(homeworker, "b1")).rejects.toMatchObject({ statusCode: 404 });
    expect(branchOverviewRepository.getStats).not.toHaveBeenCalled();
  });

  it("an org_admin may override to a homeworker branch in their org", async () => {
    vi.mocked(branchOverviewRepository.branchBelongsToOrg).mockResolvedValue(true);

    await branchOverviewService.getStats(admin, "hwb");

    expect(branchOverviewRepository.getStats).toHaveBeenCalledWith(expect.objectContaining({ orgId: "o1", branchId: "hwb" }));
  });

  it("an org_admin override to a branch outside the org is 404", async () => {
    vi.mocked(branchOverviewRepository.branchBelongsToOrg).mockResolvedValue(false);

    await expect(branchOverviewService.getStats(admin, "hwb")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a branch_manager cannot override to a homeworker branch (404)", async () => {
    await expect(branchOverviewService.getStats(manager, "hwb")).rejects.toMatchObject({ statusCode: 404 });
    expect(branchOverviewRepository.branchBelongsToOrg).not.toHaveBeenCalled();
    expect(branchOverviewRepository.getStats).not.toHaveBeenCalled();
  });

  it("a branch_manager cannot override to a homeworker branch for agent performance (404)", async () => {
    await expect(
      branchOverviewService.getAgentsPerformance(manager, "month" as never, undefined, undefined, "hwb"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a platform_admin must pass an explicit branch, otherwise org-wide (null)", async () => {
    const platform = { orgRole: "platform_admin", orgId: "o1", branchId: null } as never;

    await branchOverviewService.getStats(platform, "hwb");

    expect(branchOverviewRepository.getStats).toHaveBeenCalledWith(expect.objectContaining({ orgId: null, branchId: "hwb" }));
  });
});

describe("branchOverviewService - no branch context", () => {
  for (const role of ["branch_manager", "agent", "homeworker", "social_media_manager"]) {
    it(`${role} without a branch is 400, not org-wide stats`, async () => {
      const scope = { orgRole: role, orgRoles: [role], orgId: "o1", branchId: null, userId: "u1" } as never;

      await expect(branchOverviewService.getStats(scope)).rejects.toMatchObject({ statusCode: 400 });
      expect(branchOverviewRepository.getStats).not.toHaveBeenCalled();
    });
  }

  it("an org_admin without a branch still gets org-wide stats", async () => {
    await branchOverviewService.getStats(admin);

    expect(branchOverviewRepository.getStats).toHaveBeenCalledWith(expect.objectContaining({ orgId: "o1", branchId: null }));
  });
});

describe("branchOverviewService - partition scope", () => {
  it("passes the caller scope to the repository so buildScopeConditions can partition", async () => {
    await branchOverviewService.getStats(manager);
    expect(vi.mocked(branchOverviewRepository.getStats).mock.calls[0][0]).toMatchObject({ partitionScope: manager });
    await branchOverviewService.getAgentsPerformance(manager, "month" as never);
    expect(vi.mocked(branchOverviewRepository.getAgentsPerformance).mock.calls[0][0]).toMatchObject({ partitionScope: manager });
  });
});
