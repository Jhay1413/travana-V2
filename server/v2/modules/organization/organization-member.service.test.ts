import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: {
    listOrgMembersWithBranches: vi.fn(),
    setOrgRoleAtomic: vi.fn(),
    setActiveForUser: vi.fn(),
    findByUserAndBranch: vi.fn(),
    create: vi.fn(),
    removeFromBranch: vi.fn(),
  },
}));
vi.mock("../branch/branch.repository", () => ({ branchRepository: { findById: vi.fn() } }));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));

import { orgMemberService } from "./organization-member.service";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { branchRepository } from "../branch/branch.repository";
import { userRepository } from "../user/user.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("orgMemberService.updateRole", () => {
  it("rejects an invalid role", async () => {
    await expect(orgMemberService.updateRole("o1", "u2", "wizard", "admin1")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("prevents an admin from demoting themselves", async () => {
    await expect(orgMemberService.updateRole("o1", "u1", "agent", "u1")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("returns 404 when the target is not a member of the org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "other" } as never);

    await expect(orgMemberService.updateRole("o1", "u2", "agent", "admin1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("updates the role for a valid in-org member", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);

    const result = await orgMemberService.updateRole("o1", "u2", "branch_manager", "admin1");

    expect(branchMemberRepository.setOrgRoleAtomic).toHaveBeenCalledWith("o1", "u2", "branch_manager");
    expect(result).toEqual({ userId: "u2", orgRole: "branch_manager" });
  });
});

describe("orgMemberService.setSuspended", () => {
  it("prevents suspending your own account", async () => {
    await expect(orgMemberService.setSuspended("o1", "u1", true, "u1")).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("orgMemberService.assignToBranch", () => {
  it("returns 409 when the member is already assigned to the branch", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue({ id: "bm1" } as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1")).rejects.toMatchObject({ statusCode: 409 });
    expect(branchMemberRepository.create).not.toHaveBeenCalled();
  });

  it("returns 404 when the branch does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "bX")).rejects.toMatchObject({ statusCode: 404 });
  });
});
