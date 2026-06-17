import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./targets.repository", () => ({
  branchBelongsToOrg: vi.fn(),
  userBelongsToBranch: vi.fn(),
  getActiveBranchMemberIds: vi.fn(),
  getAllShopTargets: vi.fn(),
  bulkUpsertShopTargets: vi.fn(),
  getAllAgentTargets: vi.fn(),
  getAgentTargetsByUserId: vi.fn(),
  bulkUpsertAgentTargets: vi.fn(),
  getAllAgents: vi.fn(),
}));

import * as targetsService from "./targets.service";
import * as targetsRepository from "./targets.repository";

beforeEach(() => {
  vi.clearAllMocks();
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
