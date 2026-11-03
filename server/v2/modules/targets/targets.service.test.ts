import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./targets.repository", () => ({
  branchBelongsToOrg: vi.fn(),
  getBranchInfo: vi.fn(),
  userBelongsToBranch: vi.fn(),
  getActiveBranchMemberIds: vi.fn(),
  getAllShopTargets: vi.fn(),
  bulkUpsertShopTargets: vi.fn(),
  getAllAgentTargets: vi.fn(),
  getAgentTargetsByUserId: vi.fn(),
  bulkUpsertAgentTargets: vi.fn(),
  getAllAgents: vi.fn(),
  getShopTargetsByDateRange: vi.fn(),
  getAgentTargetsByDateRange: vi.fn(),
  getTargetSummaryByDateRange: vi.fn(),
  withTransaction: vi.fn(),
  getAgentTargetRowsForYear: vi.fn(),
  upsertAgentTargetRows: vi.fn(),
}));

import * as targetsService from "./targets.service";
import * as targetsRepository from "./targets.repository";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("targets — branch resolution", () => {
  it("requires an explicit branch override for a platform_admin", async () => {
    const scope = { orgRole: "platform_admin", orgId: "o1", branchId: null } as never;

    await expect(targetsService.getAllShopTargets(scope)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("blocks a branch user from operating on another branch", async () => {
    const scope = { orgRole: "agent", orgId: "o1", branchId: "b1" } as never;

    await expect(targetsService.getAllShopTargets(scope, "b2")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("resolves a branch_manager to their own branch", async () => {
    const scope = { orgRole: "branch_manager", orgId: "o1", branchId: "b1" } as never;
    vi.mocked(targetsRepository.getAllShopTargets).mockResolvedValue([{ id: "t1" }] as never);

    await targetsService.getAllShopTargets(scope);

    expect(targetsRepository.getAllShopTargets).toHaveBeenCalledWith("b1");
  });

  it("lets an org_admin target another branch in their org", async () => {
    const scope = { orgRole: "org_admin", orgId: "o1", branchId: null } as never;
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);
    vi.mocked(targetsRepository.getAllShopTargets).mockResolvedValue([] as never);

    await targetsService.getAllShopTargets(scope, "b2");

    expect(targetsRepository.getAllShopTargets).toHaveBeenCalledWith("b2");
  });
});

describe("targets.upsertShopTargets — validation", () => {
  const scope = { orgRole: "branch_manager", orgId: "o1", branchId: "b1" } as never;

  it("rejects an out-of-range month", async () => {
    await expect(
      targetsService.upsertShopTargets(scope, [{ month: 13, year: 2026, targetAmount: "100" }] as never),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(targetsRepository.bulkUpsertShopTargets).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range year", async () => {
    await expect(
      targetsService.upsertShopTargets(scope, [{ month: 6, year: 1999, targetAmount: "100" }] as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a negative target amount", async () => {
    await expect(
      targetsService.upsertShopTargets(scope, [{ month: 6, year: 2026, targetAmount: "-5" }] as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("persists valid targets", async () => {
    vi.mocked(targetsRepository.bulkUpsertShopTargets).mockResolvedValue([] as never);

    await targetsService.upsertShopTargets(scope, [{ month: 6, year: 2026, targetAmount: "1000" }] as never);

    expect(targetsRepository.bulkUpsertShopTargets).toHaveBeenCalledWith("b1", [
      { month: 6, year: 2026, targetAmount: "1000" },
    ]);
  });
});

describe("targets - agent/homeworker read only their own agent targets", () => {
  for (const role of ["agent", "homeworker"] as const) {
    const scope = { orgRole: role, orgId: "o1", branchId: "b1", userId: "u1" } as never;

    it(`${role}: list returns only their own rows`, async () => {
      vi.mocked(targetsRepository.getAgentTargetsByUserId).mockResolvedValue([{ id: "t1" }] as never);

      const result = await targetsService.getAllAgentTargets(scope);

      expect(targetsRepository.getAgentTargetsByUserId).toHaveBeenCalledWith("b1", "u1");
      expect(targetsRepository.getAllAgentTargets).not.toHaveBeenCalled();
      expect(result).toEqual([{ id: "t1" }]);
    });

    it(`${role}: another user target set is 403`, async () => {
      await expect(targetsService.getAgentTargetsByUserId(scope, "u2")).rejects.toMatchObject({ statusCode: 403 });
      expect(targetsRepository.getAgentTargetsByUserId).not.toHaveBeenCalled();
    });

    it(`${role}: own targets are readable`, async () => {
      vi.mocked(targetsRepository.userBelongsToBranch).mockResolvedValue(true as never);
      vi.mocked(targetsRepository.getAgentTargetsByUserId).mockResolvedValue([] as never);

      await targetsService.getAgentTargetsByUserId(scope, "u1");

      expect(targetsRepository.getAgentTargetsByUserId).toHaveBeenCalledWith("b1", "u1");
    });
  }

  it("branch_manager still reads every agent target in the branch", async () => {
    const scope = { orgRole: "branch_manager", orgId: "o1", branchId: "b1", userId: "m1" } as never;
    vi.mocked(targetsRepository.getAllAgentTargets).mockResolvedValue([] as never);

    await targetsService.getAllAgentTargets(scope);

    expect(targetsRepository.getAllAgentTargets).toHaveBeenCalledWith("b1");
  });
});

describe("targets - multi-role homeworker is treated as self-only", () => {
  const scope = { orgRole: "agent", orgRoles: ["agent", "homeworker"], orgId: "o1", branchId: "b1", userId: "u1" } as never;

  it("list is limited to the caller", async () => {
    vi.mocked(targetsRepository.getAgentTargetsByUserId).mockResolvedValue([] as never);

    await targetsService.getAllAgentTargets(scope);

    expect(targetsRepository.getAgentTargetsByUserId).toHaveBeenCalledWith("b1", "u1");
  });

  it("another user is 403", async () => {
    await expect(targetsService.getAgentTargetsByUserId(scope, "u2")).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("targets - agents list and overview are self-only for agent/homeworker", () => {
  const agents = [
    { id: "u1", name: "Me", email: "a", role: "x" },
    { id: "u2", name: "Other", email: "b", role: "x" },
  ];
  const nowYear = new Date().getFullYear();
  const targets = [
    { userId: "u1", year: nowYear, month: 1, targetAmount: "100.00" },
    { userId: "u2", year: nowYear, month: 1, targetAmount: "900.00" },
    { userId: "u1", year: nowYear, month: 2, targetAmount: "50.50" },
  ];

  function mockOverview() {
    vi.mocked(targetsRepository.getShopTargetsByDateRange).mockResolvedValue([] as never);
    vi.mocked(targetsRepository.getAgentTargetsByDateRange).mockResolvedValue(targets as never);
    vi.mocked(targetsRepository.getAllAgents).mockResolvedValue(agents as never);
    vi.mocked(targetsRepository.getTargetSummaryByDateRange).mockResolvedValue({
      shopTargets: [{ year: nowYear, month: 1, targetAmount: "5000.00" }],
      agentTargetSums: [{ year: nowYear, month: 1, total: "1000.00" }],
    } as never);
  }

  for (const [label, scope] of [
    ["agent", { orgRole: "agent", orgRoles: ["agent"], orgId: "o1", branchId: "b1", userId: "u1" }],
    ["homeworker", { orgRole: "homeworker", orgRoles: ["homeworker"], orgId: "o1", branchId: "b1", userId: "u1" }],
    ["agent+homeworker", { orgRole: "agent", orgRoles: ["agent", "homeworker"], orgId: "o1", branchId: "b1", userId: "u1" }],
  ] as const) {
    it(`${label}: getAllAgents returns only self`, async () => {
      vi.mocked(targetsRepository.getAllAgents).mockResolvedValue(agents as never);

      const result = await targetsService.getAllAgents(scope as never);

      expect(result).toEqual([agents[0]]);
    });

    it(`${label}: overview filters targets, agents and monthly totals to self`, async () => {
      mockOverview();

      const overview = await targetsService.getTargetsOverview(scope as never);

      expect(overview.agentTargets.map((t) => t.userId)).toEqual(["u1", "u1"]);
      expect(overview.agents).toEqual([agents[0]]);
      const jan = overview.summary.find((m) => m.year === nowYear && m.month === 1);
      const feb = overview.summary.find((m) => m.year === nowYear && m.month === 2);
      expect(jan?.totalAgentTargets).toBe("100.00");
      expect(jan?.shopTarget).toBe("5000.00");
      expect(feb?.totalAgentTargets).toBe("50.50");
    });
  }

  it("branch_manager still gets the full overview", async () => {
    mockOverview();
    const scope = { orgRole: "branch_manager", orgRoles: ["branch_manager"], orgId: "o1", branchId: "b1", userId: "m1" };

    const overview = await targetsService.getTargetsOverview(scope as never);

    expect(overview.agentTargets).toHaveLength(3);
    expect(overview.agents).toHaveLength(2);
    expect(overview.summary.find((m) => m.year === nowYear && m.month === 1)?.totalAgentTargets).toBe("1000.00");
  });
});


describe("targets - homeworker branches", () => {
  const hwBranch = { branchType: "homeworker", ownerUserId: "hw1" };
  const hwScope = {
    orgRole: "homeworker", orgRoles: ["homeworker"], orgId: "o1", branchId: "hwb", userId: "hw1",
    branchType: "homeworker", ownsHomeworkerBranch: true,
  } as never;
  const adminScope = { orgRole: "org_admin", orgRoles: ["org_admin"], orgId: "o1", branchId: null, userId: "a1" } as never;

  beforeEach(() => {
    vi.mocked(targetsRepository.getBranchInfo).mockResolvedValue(hwBranch as never);
  });

  it("a homeworker resolves to their own branch for agent targets", async () => {
    vi.mocked(targetsRepository.getAgentTargetsByUserId).mockResolvedValue([{ id: "t1" }] as never);

    await targetsService.getAllAgentTargets(hwScope);

    expect(targetsRepository.getAgentTargetsByUserId).toHaveBeenCalledWith("hwb", "hw1");
  });

  it("a homeworker cannot override to another branch", async () => {
    await expect(targetsService.getAllAgentTargets(hwScope, "other")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("org_admin can write the homeworker agent target via branchId override", async () => {
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);
    vi.mocked(targetsRepository.getActiveBranchMemberIds).mockResolvedValue(new Set(["hw1"]));
    vi.mocked(targetsRepository.withTransaction).mockImplementation(async (fn) => fn({} as never));
    vi.mocked(targetsRepository.getAgentTargetRowsForYear).mockResolvedValue([]);
    vi.mocked(targetsRepository.getAgentTargetsByUserId).mockResolvedValue([] as never);
    const input = [{ userId: "hw1", month: 3, year: 2026, targetAmount: "900" }];

    await targetsService.upsertAgentTargets(adminScope, input as never, "hwb");

    // Routed through the homeworker override bookkeeping, not the plain bulk upsert.
    expect(targetsRepository.bulkUpsertAgentTargets).not.toHaveBeenCalled();
    expect(targetsRepository.upsertAgentTargetRows).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ branchId: "hwb", userId: "hw1", month: 3, targetAmount: "900", source: "admin" })],
    );
  });

  it("org_admin override to a branch outside the org is 404", async () => {
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(false as never);

    await expect(targetsService.getAllAgentTargets(adminScope, "hwb")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("org_admin POST shop targets for a homeworker branch is 400", async () => {
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);

    await expect(
      targetsService.upsertShopTargets(adminScope, [{ month: 3, year: 2026, targetAmount: "100" }] as never, "hwb"),
    ).rejects.toMatchObject({ statusCode: 400, message: "Homeworker branches do not have shop targets" });
    expect(targetsRepository.bulkUpsertShopTargets).not.toHaveBeenCalled();
  });

  it("reading shop targets of a homeworker branch returns nothing without querying", async () => {
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);

    const result = await targetsService.getAllShopTargets(adminScope, "hwb");

    expect(result).toEqual([]);
    expect(targetsRepository.getAllShopTargets).not.toHaveBeenCalled();
  });

  it("shop branch writes still work", async () => {
    vi.mocked(targetsRepository.getBranchInfo).mockResolvedValue({ branchType: "shop", ownerUserId: null } as never);
    vi.mocked(targetsRepository.bulkUpsertShopTargets).mockResolvedValue([] as never);
    const scope = { orgRole: "branch_manager", orgId: "o1", branchId: "b1" } as never;

    await targetsService.upsertShopTargets(scope, [{ month: 3, year: 2026, targetAmount: "100" }] as never);

    expect(targetsRepository.bulkUpsertShopTargets).toHaveBeenCalledWith("b1", expect.any(Array));
  });

  it("getAllAgents for a homeworker branch returns just the owner", async () => {
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);
    vi.mocked(targetsRepository.getAllAgents).mockResolvedValue([
      { id: "hw1", name: "H", email: "h", role: "x" },
      { id: "stray", name: "S", email: "s", role: "x" },
    ] as never);

    const result = await targetsService.getAllAgents(adminScope, "hwb");

    expect(result.map((a) => a.id)).toEqual(["hw1"]);
  });

  it("overview for a homeworker branch has only the agent target, shop target zero", async () => {
    const y = new Date().getFullYear();
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);
    vi.mocked(targetsRepository.getAgentTargetsByDateRange).mockResolvedValue([
      { userId: "hw1", year: y, month: 1, targetAmount: "700.00" },
      { userId: "stray", year: y, month: 1, targetAmount: "50.00" },
    ] as never);
    vi.mocked(targetsRepository.getAllAgents).mockResolvedValue([
      { id: "hw1", name: "H", email: "h", role: "x" },
      { id: "stray", name: "S", email: "s", role: "x" },
    ] as never);
    vi.mocked(targetsRepository.getTargetSummaryByDateRange).mockResolvedValue({
      shopTargets: [{ year: y, month: 1, targetAmount: "5000.00" }],
      agentTargetSums: [{ year: y, month: 1, total: "750.00" }],
    } as never);

    const overview = await targetsService.getTargetsOverview(adminScope, "hwb");

    expect(targetsRepository.getShopTargetsByDateRange).not.toHaveBeenCalled();
    expect(overview.shopTargets).toEqual([]);
    expect(overview.agents.map((a) => a.id)).toEqual(["hw1"]);
    expect(overview.agentTargets.map((t) => t.userId)).toEqual(["hw1"]);
    const jan = overview.summary.find((m) => m.year === y && m.month === 1);
    expect(jan?.shopTarget).toBe("0.00");
    expect(jan?.totalAgentTargets).toBe("700.00");
  });
});


describe("targets - homeworker branch edge cases", () => {
  const adminScope = { orgRole: "org_admin", orgRoles: ["org_admin"], orgId: "o1", branchId: null, userId: "a1" } as never;

  it("legacy shared homeworker branch (no owner) keeps the full agent list for admins", async () => {
    vi.mocked(targetsRepository.getBranchInfo).mockResolvedValue({ branchType: "homeworker", ownerUserId: null } as never);
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);
    vi.mocked(targetsRepository.getAllAgents).mockResolvedValue([
      { id: "u1", name: "A", email: "a", role: "x" },
      { id: "u2", name: "B", email: "b", role: "x" },
    ] as never);
    vi.mocked(targetsRepository.getAllAgentTargets).mockResolvedValue([{ id: "t" }] as never);

    expect((await targetsService.getAllAgents(adminScope, "shared")).map((a) => a.id)).toEqual(["u1", "u2"]);
    expect(await targetsService.getAllAgentTargets(adminScope, "shared")).toEqual([{ id: "t" }]);
  });

  it("legacy shared homeworker branch keeps self-only reads for a homeworker", async () => {
    vi.mocked(targetsRepository.getBranchInfo).mockResolvedValue({ branchType: "homeworker", ownerUserId: null } as never);
    vi.mocked(targetsRepository.getAgentTargetsByUserId).mockResolvedValue([] as never);
    const scope = { orgRole: "homeworker", orgRoles: ["homeworker"], orgId: "o1", branchId: "shared", userId: "u1" } as never;

    await targetsService.getAllAgentTargets(scope);

    expect(targetsRepository.getAgentTargetsByUserId).toHaveBeenCalledWith("shared", "u1");
  });

  it("legacy shared branch overview still sums every agent but has no shop target", async () => {
    const y = new Date().getFullYear();
    vi.mocked(targetsRepository.getBranchInfo).mockResolvedValue({ branchType: "homeworker", ownerUserId: null } as never);
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);
    vi.mocked(targetsRepository.getAgentTargetsByDateRange).mockResolvedValue([
      { userId: "u1", year: y, month: 1, targetAmount: "1.00" },
      { userId: "u2", year: y, month: 1, targetAmount: "2.00" },
    ] as never);
    vi.mocked(targetsRepository.getAllAgents).mockResolvedValue([{ id: "u1" }, { id: "u2" }] as never);
    vi.mocked(targetsRepository.getTargetSummaryByDateRange).mockResolvedValue({
      shopTargets: [], agentTargetSums: [{ year: y, month: 1, total: "3.00" }],
    } as never);

    const overview = await targetsService.getTargetsOverview(adminScope, "shared");

    expect(overview.agents).toHaveLength(2);
    expect(overview.summary.find((m) => m.year === y && m.month === 1)?.totalAgentTargets).toBe("3.00");
    expect(targetsRepository.getTargetSummaryByDateRange).toHaveBeenCalledWith("shared", y, 1, expect.any(Number), expect.any(Number), false);
  });

  it("owned homeworker branch: admin agent-target list is owner-filtered", async () => {
    vi.mocked(targetsRepository.getBranchInfo).mockResolvedValue({ branchType: "homeworker", ownerUserId: "hw1" } as never);
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);
    vi.mocked(targetsRepository.getAgentTargetsByUserId).mockResolvedValue([{ id: "t" }] as never);

    await targetsService.getAllAgentTargets(adminScope, "hwb");

    expect(targetsRepository.getAgentTargetsByUserId).toHaveBeenCalledWith("hwb", "hw1");
    expect(targetsRepository.getAllAgentTargets).not.toHaveBeenCalled();
  });

  it("owned homeworker branch: upserting a target for anyone but the owner is 400", async () => {
    vi.mocked(targetsRepository.getBranchInfo).mockResolvedValue({ branchType: "homeworker", ownerUserId: "hw1" } as never);
    vi.mocked(targetsRepository.branchBelongsToOrg).mockResolvedValue(true as never);

    await expect(
      targetsService.upsertAgentTargets(adminScope, [{ userId: "other", month: 3, year: 2026, targetAmount: "5" }] as never, "hwb"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(targetsRepository.bulkUpsertAgentTargets).not.toHaveBeenCalled();
  });

  it("a branch_manager cannot override into a homeworker branch (404)", async () => {
    const scope = { orgRole: "branch_manager", orgRoles: ["branch_manager"], orgId: "o1", branchId: "b1", userId: "m1" } as never;

    await expect(targetsService.getAllAgentTargets(scope, "hwb")).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      targetsService.upsertAgentTargets(scope, [{ userId: "hw1", month: 3, year: 2026, targetAmount: "5" }] as never, "hwb"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(targetsRepository.branchBelongsToOrg).not.toHaveBeenCalled();
  });
});
