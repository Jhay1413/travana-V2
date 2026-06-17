import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./user-org-roles.repository", () => ({
  userOrgRolesRepository: {
    findRolesByUserAndOrg: vi.fn(),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    updateUserOrgRole: vi.fn(),
    findUserRole: vi.fn(),
  },
}));
vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveByUserId: vi.fn() },
}));
vi.mock("../platform-admin/platform-admin-audit.repository", () => ({
  platformAdminAuditRepository: { create: vi.fn() },
}));

import { userOrgRolesService, primaryRole } from "./user-org-roles.service";
import { userOrgRolesRepository } from "./user-org-roles.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";

const ACTOR = { userId: "admin1", ipAddress: null, userAgent: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("primaryRole — role ranking", () => {
  it("returns the highest-ranked role from the set", () => {
    expect(primaryRole(["agent", "org_admin", "homeworker"])).toBe("org_admin");
    expect(primaryRole(["homeworker", "agent"])).toBe("agent");
  });

  it("returns null for an empty set", () => {
    expect(primaryRole([])).toBeNull();
  });
});

describe("userOrgRolesService.addRole", () => {
  it("rejects an unknown role", async () => {
    await expect(userOrgRolesService.addRole("u1", "o1", "wizard", ACTOR)).rejects.toMatchObject({ statusCode: 400 });
    expect(userOrgRolesRepository.addRole).not.toHaveBeenCalled();
  });

  it("is a no-op when the user already has the role", async () => {
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"] as never);

    await userOrgRolesService.addRole("u1", "o1", "agent", ACTOR);

    expect(userOrgRolesRepository.addRole).not.toHaveBeenCalled();
  });

  it("refuses to combine referral_agent with an internal role", async () => {
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"] as never);

    await expect(userOrgRolesService.addRole("u1", "o1", "referral_agent", ACTOR)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(userOrgRolesRepository.addRole).not.toHaveBeenCalled();
  });

  it("adds a valid role and recomputes the primary", async () => {
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"] as never);

    await userOrgRolesService.addRole("u1", "o1", "org_admin", ACTOR);

    expect(userOrgRolesRepository.addRole).toHaveBeenCalledOnce();
    expect(userOrgRolesRepository.updateUserOrgRole).toHaveBeenCalledWith("u1", "org_admin");
  });
});

describe("userOrgRolesService.removeRole", () => {
  it("refuses to remove the user's last remaining role", async () => {
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"] as never);
    vi.mocked(branchMemberRepository.findActiveByUserId).mockResolvedValue(null as never);
    vi.mocked(userOrgRolesRepository.findUserRole).mockResolvedValue("agent" as never);

    await expect(userOrgRolesService.removeRole("u1", "o1", "agent", ACTOR)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(userOrgRolesRepository.removeRole).not.toHaveBeenCalled();
  });

  it("removes a role when others remain and recomputes the primary", async () => {
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["org_admin", "agent"] as never);

    await userOrgRolesService.removeRole("u1", "o1", "agent", ACTOR);

    expect(userOrgRolesRepository.removeRole).toHaveBeenCalledWith("u1", "o1", "agent");
    expect(userOrgRolesRepository.updateUserOrgRole).toHaveBeenCalledWith("u1", "org_admin");
  });

  it("allows removing the last user_org_roles entry when a branch membership role remains", async () => {
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"] as never);
    vi.mocked(branchMemberRepository.findActiveByUserId).mockResolvedValue({ orgId: "o1", orgRole: "branch_manager" } as never);
    vi.mocked(userOrgRolesRepository.findUserRole).mockResolvedValue("agent" as never);

    await userOrgRolesService.removeRole("u1", "o1", "agent", ACTOR);

    expect(userOrgRolesRepository.removeRole).toHaveBeenCalledOnce();
  });
});
