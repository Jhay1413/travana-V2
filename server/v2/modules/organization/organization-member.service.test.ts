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
vi.mock("../homeworker/homeworker.service", () => ({ homeworkerService: { assertNotArchived: vi.fn() } }));
vi.mock("../user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findRolesByUserAndOrg: vi.fn() },
}));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));

import { orgMemberService } from "./organization-member.service";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { branchRepository } from "../branch/branch.repository";
import { userRepository } from "../user/user.repository";
import { homeworkerService } from "../homeworker/homeworker.service";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([] as never);
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

describe("orgMemberService.updateRole — homeworker", () => {
  it("rejects moving a member into homeworker (400)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);

    await expect(orgMemberService.updateRole("o1", "u2", "homeworker", "admin1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("rejects moving a homeworker out to another role (400)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "homeworker" } as never);

    await expect(orgMemberService.updateRole("o1", "u2", "agent", "admin1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });
});

describe("orgMemberService.updateRole - legacy role union", () => {
  it("blocks moving a legacy {agent, homeworker} user (primary agent) to another role", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent", "homeworker"] as never);

    await expect(orgMemberService.updateRole("o1", "u2", "branch_manager", "admin1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });
});

describe("orgMemberService.setSuspended", () => {
  it("refuses to reactivate a member who owns an archived homeworker branch", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "hw1", orgId: "o1" } as never);
    vi.mocked(homeworkerService.assertNotArchived).mockRejectedValueOnce(
      Object.assign(new Error("Homeworker is archived; re-invite instead"), { statusCode: 400 }),
    );

    await expect(orgMemberService.setSuspended("o1", "hw1", false, "admin1")).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.setActiveForUser).not.toHaveBeenCalled();
  });

  it("reactivates normally when not archived, and suspending skips the archive check", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);

    await orgMemberService.setSuspended("o1", "u2", false, "admin1");
    expect(homeworkerService.assertNotArchived).toHaveBeenCalledWith("o1", "u2");
    expect(branchMemberRepository.setActiveForUser).toHaveBeenCalledWith("o1", "u2", true);

    vi.mocked(homeworkerService.assertNotArchived).mockClear();
    await orgMemberService.setSuspended("o1", "u2", true, "admin1");
    expect(homeworkerService.assertNotArchived).not.toHaveBeenCalled();
  });

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

  it("rejects giving a homeworker a membership with a different role", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "homeworker" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", "agent")).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.create).not.toHaveBeenCalled();
  });

  it("rejects giving a non-homeworker a homeworker membership", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", "homeworker")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns the invite-only 400 when assigning into the homeworker role", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", "homeworker")).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
  });

  it("refuses to assign a homeworker to a second branch (400)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "homeworker" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1")).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.create).not.toHaveBeenCalled();
  });

  it("rejects assigning anyone into a homeworker branch outright, whatever the owner state", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "hb1", branchType: "homeworker", ownerUserId: null } as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "hb1")).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.create).not.toHaveBeenCalled();
  });

  it("rejects assigning a legacy {agent, homeworker} user with any role", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent", "homeworker"] as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 404 when the branch does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "bX")).rejects.toMatchObject({ statusCode: 404 });
  });
});
