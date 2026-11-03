import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./branch.repository", () => ({
  branchRepository: {
    findAllByOrg: vi.fn(),
    findById: vi.fn(),
    findOrgIdById: vi.fn(),
    countByOrg: vi.fn(),
    createAtomic: vi.fn(),
    updateAtomic: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserId: vi.fn() },
}));
vi.mock("../plan/plan.service", () => ({ planService: { assertCanAddBranch: vi.fn() } }));

import { branchService } from "./branch.service";
import { branchRepository } from "./branch.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { listBranchesSchema, updateBranchSchema } from "./branch.validator";

const ADMIN = { orgId: "o1", orgRole: "org_admin" as const, orgRoles: ["org_admin" as const], userId: "admin1" };
const AGENT = { orgId: "o1", orgRole: "agent" as const, orgRoles: ["agent" as const], userId: "u1" };
const HW_BRANCH = { id: "hb1", organizationId: "o1", branchType: "homeworker", ownerUserId: "hw1", isDefault: false };
const SHOP_BRANCH = { id: "b1", organizationId: "o1", branchType: "shop", ownerUserId: null, isDefault: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("branchService.list", () => {
  it("defaults to shop branches", async () => {
    vi.mocked(branchRepository.findAllByOrg).mockResolvedValue([]);

    await branchService.list(AGENT);

    expect(branchRepository.findAllByOrg).toHaveBeenCalledWith("o1", "shop");
  });

  it("allows type=homeworker for org admins and platform admins", async () => {
    vi.mocked(branchRepository.findAllByOrg).mockResolvedValue([]);

    await branchService.list(ADMIN, "homeworker");
    await branchService.list({ ...ADMIN, orgRole: "platform_admin", orgRoles: ["platform_admin"] }, "homeworker");

    expect(branchRepository.findAllByOrg).toHaveBeenCalledWith("o1", "homeworker");
    expect(branchRepository.findAllByOrg).toHaveBeenCalledTimes(2);
  });

  it("403s type=homeworker for other roles", async () => {
    for (const role of ["agent", "branch_manager", "homeworker", "social_media_manager"] as const) {
      await expect(
        branchService.list({ orgId: "o1", orgRole: role, orgRoles: [role] }, "homeworker"),
      ).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(branchRepository.findAllByOrg).not.toHaveBeenCalled();
  });
});

describe("branchService.list - homeworker callers", () => {
  const HW = { orgId: "o1", orgRole: "homeworker" as const, orgRoles: ["homeworker" as const], userId: "hw1" };

  it("returns only the homeworker's own branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({ orgId: "o1", branchId: "hb1" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue(HW_BRANCH as never);

    await expect(branchService.list(HW)).resolves.toEqual([HW_BRANCH]);
    expect(branchRepository.findAllByOrg).not.toHaveBeenCalled();
  });

  it("returns [] when the homeworker has no active branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);

    await expect(branchService.list(HW)).resolves.toEqual([]);
    expect(branchRepository.findAllByOrg).not.toHaveBeenCalled();
  });

  it("also restricts a legacy {agent, homeworker} user (primary agent)", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({ orgId: "o1", branchId: "b1" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue(SHOP_BRANCH as never);

    await expect(
      branchService.list({ orgId: "o1", orgRole: "agent", orgRoles: ["agent", "homeworker"], userId: "hw1" }),
    ).resolves.toEqual([SHOP_BRANCH]);
    expect(branchRepository.findAllByOrg).not.toHaveBeenCalled();
  });
});

describe("branchService.getById", () => {
  it("lets admins and the owner open a homeworker branch", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(HW_BRANCH as never);

    await expect(branchService.getById("hb1", ADMIN)).resolves.toBe(HW_BRANCH);
    await expect(
      branchService.getById("hb1", { orgId: "o1", orgRole: "homeworker", orgRoles: ["homeworker"], userId: "hw1" }),
    ).resolves.toBe(HW_BRANCH);
  });

  it("hides a homeworker branch from everyone else (404)", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(HW_BRANCH as never);

    await expect(branchService.getById("hb1", AGENT)).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      branchService.getById("hb1", { orgId: "o1", orgRole: "homeworker", orgRoles: ["homeworker"], userId: "hw2" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      branchService.getById("hb1", { orgId: "o1", orgRole: "branch_manager", orgRoles: ["branch_manager"], userId: null }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("opens a shop branch for anyone in the org", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(SHOP_BRANCH as never);

    await expect(branchService.getById("b1", AGENT)).resolves.toBe(SHOP_BRANCH);
  });
});

describe("branchService.remove", () => {
  it("returns 400 (archive instead) for a homeworker branch", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(HW_BRANCH as never);

    await expect(branchService.remove("hb1", "o1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Archive the homeworker instead",
    });
    expect(branchRepository.remove).not.toHaveBeenCalled();
  });

  it("keeps the at-least-one-shop-branch rule using the shop-only count", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(SHOP_BRANCH as never);
    vi.mocked(branchRepository.countByOrg).mockResolvedValue(1);

    await expect(branchService.remove("b1", "o1")).rejects.toMatchObject({ statusCode: 400 });
    expect(branchRepository.remove).not.toHaveBeenCalled();
  });
});

describe("branchService.update", () => {
  it("allows name and contact fields on a homeworker branch", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(HW_BRANCH as never);
    vi.mocked(branchRepository.updateAtomic).mockResolvedValue(HW_BRANCH as never);

    await branchService.update("hb1", { name: "New", phone: "123", email: "a@b.com" }, "o1");

    expect(branchRepository.updateAtomic).toHaveBeenCalledWith("hb1", { name: "New", phone: "123", email: "a@b.com" }, "o1", false);
  });

  it("refuses isActive / isDefault on a homeworker branch (400, archive instead)", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(HW_BRANCH as never);

    await expect(branchService.update("hb1", { isActive: false }, "o1")).rejects.toMatchObject({ statusCode: 400 });
    await expect(branchService.update("hb1", { isDefault: true }, "o1")).rejects.toMatchObject({ statusCode: 400 });
    expect(branchRepository.updateAtomic).not.toHaveBeenCalled();
  });

  it("drops branchType / ownerUserId / profitSharePercent smuggled into the body", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(HW_BRANCH as never);
    vi.mocked(branchRepository.updateAtomic).mockResolvedValue(HW_BRANCH as never);

    await branchService.update(
      "hb1",
      { name: "N", branchType: "shop", ownerUserId: "evil", profitSharePercent: "99" } as never,
      "o1",
    );

    expect(branchRepository.updateAtomic).toHaveBeenCalledWith("hb1", { name: "N" }, "o1", false);
  });

  it("strips branchType from shop-branch updates too", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(SHOP_BRANCH as never);
    vi.mocked(branchRepository.updateAtomic).mockResolvedValue(SHOP_BRANCH as never);

    await branchService.update("b1", { name: "N", branchType: "homeworker" } as never, "o1");

    expect(branchRepository.updateAtomic).toHaveBeenCalledWith("b1", { name: "N" }, "o1", false);
  });

  it("does not write when a homeworker patch has no editable fields", async () => {
    vi.mocked(branchRepository.findById).mockResolvedValue(HW_BRANCH as never);

    await expect(branchService.update("hb1", {}, "o1")).resolves.toBe(HW_BRANCH);
    expect(branchRepository.updateAtomic).not.toHaveBeenCalled();
  });
});

describe("branch validators", () => {
  it("does not accept branchType or owner fields on update", () => {
    const parsed = updateBranchSchema.parse({ body: { name: "X", branchType: "shop", ownerUserId: "u" } });
    expect(parsed.body).toEqual({ name: "X" });
  });

  it("restricts the list type query to shop or homeworker", () => {
    expect(listBranchesSchema.safeParse({ query: { type: "homeworker" } }).success).toBe(true);
    expect(listBranchesSchema.safeParse({ query: {} }).success).toBe(true);
    expect(listBranchesSchema.safeParse({ query: { type: "other" } }).success).toBe(false);
  });
});
