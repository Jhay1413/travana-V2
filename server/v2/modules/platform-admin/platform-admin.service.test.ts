import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./platform-admin.repository", () => ({
  platformAdminRepository: { findUserByIdAcrossOrgs: vi.fn() },
}));
vi.mock("./platform-admin-audit.repository", () => ({
  platformAdminAuditRepository: { create: vi.fn() },
}));
vi.mock("../user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findRolesByUserAndOrg: vi.fn() },
}));
vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: { setOrgRoleAtomic: vi.fn() },
}));

import { platformAdminService } from "./platform-admin.service";
import { platformAdminRepository } from "./platform-admin.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";

const ACTOR = { userId: "pa1", ipAddress: null, userAgent: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([] as never);
});

describe("platformAdminService.changeUserOrgRole", () => {
  it("syncs all role stores through setOrgRoleAtomic", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({
      id: "u1",
      orgId: "o1",
      orgRole: "agent",
    } as never);

    await platformAdminService.changeUserOrgRole("o1", "u1", "branch_manager", ACTOR);

    expect(branchMemberRepository.setOrgRoleAtomic).toHaveBeenCalledWith("o1", "u1", "branch_manager");
    expect((platformAdminRepository as Record<string, unknown>).setUserOrgRole).toBeUndefined();
  });

  it("rejects moving a user into homeworker (400)", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({ id: "u1", orgId: "o1", orgRole: "agent" } as never);

    await expect(platformAdminService.changeUserOrgRole("o1", "u1", "homeworker", ACTOR)).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("rejects moving a homeworker out to another role (400)", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({ id: "u1", orgId: "o1", orgRole: "homeworker" } as never);

    await expect(platformAdminService.changeUserOrgRole("o1", "u1", "agent", ACTOR)).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("blocks a legacy {agent, homeworker} user (primary agent) from changing role", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({ id: "u1", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent", "homeworker"] as never);

    await expect(platformAdminService.changeUserOrgRole("o1", "u1", "branch_manager", ACTOR)).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("rejects an invalid role without writing", async () => {
    await expect(platformAdminService.changeUserOrgRole("o1", "u1", "wizard" as never, ACTOR)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("404s when the user is in another org", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({ id: "u1", orgId: "other" } as never);

    await expect(platformAdminService.changeUserOrgRole("o1", "u1", "agent", ACTOR)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });
});
