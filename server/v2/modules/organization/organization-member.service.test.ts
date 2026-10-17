import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: {
    listOrgMembersWithBranches: vi.fn(),
    setOrgRoleAtomic: vi.fn(),
    setActiveForUser: vi.fn(),
    findStandingByUserId: vi.fn(),
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
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn(), update: vi.fn() } }));
vi.mock("../user/user-access.service", () => ({ userAccessService: { revokeAccess: vi.fn() } }));
vi.mock("./organization.repository", () => ({ organizationRepository: { findById: vi.fn() } }));
vi.mock("./organization-audit.service", () => ({ organizationAuditService: { record: vi.fn() } }));
vi.mock("./organization-seat.service", () => ({ organizationSeatService: { assertSeatAvailable: vi.fn() } }));
vi.mock("./organization-member-email.service", () => ({ sendSuspensionEmail: vi.fn() }));

import { orgMemberService } from "./organization-member.service";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { branchRepository } from "../branch/branch.repository";
import { userRepository } from "../user/user.repository";
import { userAccessService } from "../user/user-access.service";
import { homeworkerService } from "../homeworker/homeworker.service";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";
import { organizationRepository } from "./organization.repository";
import { organizationAuditService } from "./organization-audit.service";
import { organizationSeatService } from "./organization-seat.service";
import { sendSuspensionEmail } from "./organization-member-email.service";

const ADMIN = { userId: "admin1", ipAddress: "1.2.3.4", userAgent: "ua", impersonating: false };
const SELF = { ...ADMIN, userId: "u1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([] as never);
  vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 1 });
  vi.mocked(userAccessService.revokeAccess).mockResolvedValue(3);
});

describe("orgMemberService.updateRole", () => {
  it("rejects an invalid role", async () => {
    await expect(orgMemberService.updateRole("o1", "u2", "wizard", ADMIN)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("prevents an admin from demoting themselves", async () => {
    await expect(orgMemberService.updateRole("o1", "u1", "agent", SELF)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("returns 404 when the target is not a member of the org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "other" } as never);

    await expect(orgMemberService.updateRole("o1", "u2", "agent", ADMIN)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("returns 409 for a removed member", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: "u2", orgId: "o1", banned: true, banReason: "Removed by Alex",
    } as never);

    await expect(orgMemberService.updateRole("o1", "u2", "agent", ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("updates the role for a valid in-org member and audits from/to", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);

    const result = await orgMemberService.updateRole("o1", "u2", "branch_manager", ADMIN);

    expect(branchMemberRepository.setOrgRoleAtomic).toHaveBeenCalledWith("o1", "u2", "branch_manager");
    expect(result).toEqual({ userId: "u2", orgRole: "branch_manager" });
    expect(organizationAuditService.record).toHaveBeenCalledWith({
      actor: ADMIN, action: "member.role.change", orgId: "o1", targetUserId: "u2",
      metadata: { from: "agent", to: "branch_manager" },
    });
  });
});

describe("orgMemberService.updateRole — homeworker", () => {
  it("rejects moving a member into homeworker (400)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);

    await expect(orgMemberService.updateRole("o1", "u2", "homeworker", ADMIN)).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("rejects moving a homeworker out to another role (400)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "homeworker" } as never);

    await expect(orgMemberService.updateRole("o1", "u2", "agent", ADMIN)).rejects.toMatchObject({
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

    await expect(orgMemberService.updateRole("o1", "u2", "branch_manager", ADMIN)).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });
});

describe("orgMemberService.setSuspended", () => {
  it("prevents suspending your own account", async () => {
    await expect(orgMemberService.setSuspended("o1", "u1", true, SELF)).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.setActiveForUser).not.toHaveBeenCalled();
  });

  it("returns 404 when the target is not in the org", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "other" } as never);
    await expect(orgMemberService.setSuspended("o1", "u2", true, ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("returns 409 for a removed member", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: "u2", orgId: "o1", banned: true, banReason: "Removed by Alex",
    } as never);
    await expect(orgMemberService.setSuspended("o1", "u2", false, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(branchMemberRepository.setActiveForUser).not.toHaveBeenCalled();
  });

  it("returns 400 for a pending invite (revoke instead)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", inviteToken: "tok" } as never);
    await expect(orgMemberService.setSuspended("o1", "u2", true, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.setActiveForUser).not.toHaveBeenCalled();
  });

  it("suspends: deactivates memberships, deletes sessions after, audits, no email by default", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", email: "u2@x.com" } as never);
    const order: string[] = [];
    vi.mocked(branchMemberRepository.setActiveForUser).mockImplementation(async () => { order.push("set"); });
    vi.mocked(userAccessService.revokeAccess).mockImplementation(async () => { order.push("sessions"); return 1; });

    const result = await orgMemberService.setSuspended("o1", "u2", true, ADMIN);

    expect(result).toEqual({ userId: "u2", suspended: true });
    expect(branchMemberRepository.setActiveForUser).toHaveBeenCalledWith("o1", "u2", false);
    expect(order).toEqual(["set", "sessions"]);
    expect(userAccessService.revokeAccess).toHaveBeenCalledWith("u2");
    expect(sendSuspensionEmail).not.toHaveBeenCalled();
    expect(homeworkerService.assertNotArchived).not.toHaveBeenCalled();
    expect(organizationAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.suspend", targetUserId: "u2", orgId: "o1", metadata: { notified: false, sessionsDeleted: 1 } }),
    );
  });

  it("emails the member only when notify is true", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", email: "u2@x.com" } as never);
    vi.mocked(organizationRepository.findById).mockResolvedValue({ id: "o1", name: "Acme" } as never);

    await orgMemberService.setSuspended("o1", "u2", true, ADMIN, true);

    expect(sendSuspensionEmail).toHaveBeenCalledWith("u2@x.com", "Acme");
  });

  it("refuses to reactivate a member who owns an archived homeworker branch (400)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "hw1", orgId: "o1" } as never);
    vi.mocked(homeworkerService.assertNotArchived).mockRejectedValueOnce(
      Object.assign(new Error("Homeworker is archived; re-invite instead"), { statusCode: 400 }),
    );

    await expect(orgMemberService.setSuspended("o1", "hw1", false, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.setActiveForUser).not.toHaveBeenCalled();
  });

  it("reactivates a suspended member when a seat is free, and audits it", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });

    const result = await orgMemberService.setSuspended("o1", "u2", false, ADMIN);

    expect(result).toEqual({ userId: "u2", suspended: false });
    expect(homeworkerService.assertNotArchived).toHaveBeenCalledWith("o1", "u2");
    expect(organizationSeatService.assertSeatAvailable).toHaveBeenCalledWith("o1");
    expect(branchMemberRepository.setActiveForUser).toHaveBeenCalledWith("o1", "u2", true);
    expect(userAccessService.revokeAccess).not.toHaveBeenCalled();
    expect(organizationAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.reactivate" }),
    );
  });

  it("returns the seat 409 on reactivation when every seat is taken", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });
    vi.mocked(organizationSeatService.assertSeatAvailable).mockRejectedValueOnce(
      Object.assign(new Error("All 10 seats are in use"), { statusCode: 409 }),
    );

    await expect(orgMemberService.setSuspended("o1", "u2", false, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(branchMemberRepository.setActiveForUser).not.toHaveBeenCalled();
  });

  it("does not seat-check re-confirming an already active member or a referral-only one", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    await orgMemberService.setSuspended("o1", "u2", false, ADMIN);
    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();

    vi.mocked(userRepository.findById).mockResolvedValue({ id: "r1", orgId: "o1", orgRole: "referral_agent" } as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["referral_agent"] as never);
    await orgMemberService.setSuspended("o1", "r1", false, ADMIN);
    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();
  });
});

describe("orgMemberService.assignToBranch", () => {
  it("returns 409 when the member is already assigned to the branch", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue({ id: "bm1" } as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", undefined, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(branchMemberRepository.create).not.toHaveBeenCalled();
  });

  it("returns 409 for a removed member", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({
      id: "u2", orgId: "o1", banned: true, banReason: "Removed by Alex",
    } as never);
    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", undefined, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("creates an ACTIVE membership for an active member and audits it", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);

    await orgMemberService.assignToBranch("o1", "u2", "b1", undefined, ADMIN);

    expect(branchMemberRepository.create).toHaveBeenCalledWith({
      orgId: "o1", branchId: "b1", userId: "u2", orgRole: "agent", isActive: true,
    });
    expect(organizationAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.branch.assign", metadata: { branchId: "b1", orgRole: "agent" } }),
    );
  });

  it("creates an INACTIVE membership for a suspended member (no silent reactivation)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });

    await orgMemberService.assignToBranch("o1", "u2", "b1", undefined, ADMIN);

    expect(branchMemberRepository.create).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });

  it("rejects giving a homeworker a membership with a different role", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "homeworker" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", "agent", ADMIN)).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.create).not.toHaveBeenCalled();
  });

  it("returns the invite-only 400 when assigning into the homeworker role", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", "homeworker", ADMIN)).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are created by invite; archive and re-invite instead",
    });
  });

  it("refuses to assign a homeworker to a second branch (400)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "homeworker" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(branchMemberRepository.findByUserAndBranch).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", undefined, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
    expect(branchMemberRepository.create).not.toHaveBeenCalled();
  });

  it("rejects assigning anyone into a homeworker branch outright", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "hb1", branchType: "homeworker", ownerUserId: null } as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "hb1", undefined, ADMIN)).rejects.toMatchObject({
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

    await expect(orgMemberService.assignToBranch("o1", "u2", "b1", undefined, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 404 when the branch does not exist", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue(undefined as never);

    await expect(orgMemberService.assignToBranch("o1", "u2", "bX", undefined, ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("orgMemberService.unassignFromBranch", () => {
  it("removes the membership and audits it", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue({ id: "b1" } as never);

    await orgMemberService.unassignFromBranch("o1", "u2", "b1", ADMIN);

    expect(branchMemberRepository.removeFromBranch).toHaveBeenCalledWith("b1", "u2");
    expect(organizationAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.branch.unassign", metadata: { branchId: "b1" } }),
    );
  });

  it("refuses for a suspended member, who would otherwise read as unassigned and regain access (409)", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });

    await expect(orgMemberService.unassignFromBranch("o1", "u2", "b1", ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(branchMemberRepository.removeFromBranch).not.toHaveBeenCalled();
  });

  it("returns 404 for a user outside the org and 404 for an unknown branch", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "other" } as never);
    await expect(orgMemberService.unassignFromBranch("o1", "u2", "b1", ADMIN)).rejects.toMatchObject({ statusCode: 404 });

    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1" } as never);
    vi.mocked(branchRepository.findById).mockResolvedValue(undefined as never);
    await expect(orgMemberService.unassignFromBranch("o1", "u2", "bX", ADMIN)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("orgMemberService.updateProfile", () => {
  const target = { id: "u2", orgId: "o1", role: "Agent", firstName: "Old", lastName: "Name", name: "Old Name", phoneNumber: "1" };

  it("updates names and phone, rebuilding the display name, and audits the fields", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(target as never);
    vi.mocked(userRepository.update).mockResolvedValue({
      ...target, firstName: "Ada", name: "Ada Name", phoneNumber: "07000 000000",
    } as never);

    const result = await orgMemberService.updateProfile("o1", "u2", { firstName: "Ada", phoneNumber: "07000 000000" }, ADMIN);

    expect(userRepository.update).toHaveBeenCalledWith("u2", {
      firstName: "Ada", lastName: "Name", name: "Ada Name", phoneNumber: "07000 000000",
    });
    expect(result).toEqual({ userId: "u2", firstName: "Ada", lastName: "Name", phoneNumber: "07000 000000", name: "Ada Name" });
    expect(organizationAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.profile.update", metadata: { fields: ["firstName", "phoneNumber"] } }),
    );
  });

  it("never sends email, role or any other field to the repository", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue(target as never);
    vi.mocked(userRepository.update).mockResolvedValue(target as never);

    await orgMemberService.updateProfile("o1", "u2", { lastName: "Smith" }, ADMIN);

    const patch = vi.mocked(userRepository.update).mock.calls[0][1];
    expect(Object.keys(patch).sort()).toEqual(["firstName", "lastName", "name"]);
  });

  it("returns 404 outside the org, 403 for a platform admin, 409 for a removed member", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ ...target, orgId: "other" } as never);
    await expect(orgMemberService.updateProfile("o1", "u2", { firstName: "A" }, ADMIN)).rejects.toMatchObject({ statusCode: 404 });

    vi.mocked(userRepository.findById).mockResolvedValue({ ...target, role: "platform_admin" } as never);
    await expect(orgMemberService.updateProfile("o1", "u2", { firstName: "A" }, ADMIN)).rejects.toMatchObject({ statusCode: 403 });

    vi.mocked(userRepository.findById).mockResolvedValue({ ...target, banned: true, banReason: "Removed by X" } as never);
    await expect(orgMemberService.updateProfile("o1", "u2", { firstName: "A" }, ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});

describe("platform admin targets are off limits (403)", () => {
  beforeEach(() => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "pa", orgId: "o1", role: "platform_admin" } as never);
  });

  it("updateRole, setSuspended, assignToBranch, unassignFromBranch all refuse", async () => {
    await expect(orgMemberService.updateRole("o1", "pa", "agent", ADMIN)).rejects.toMatchObject({ statusCode: 403 });
    await expect(orgMemberService.setSuspended("o1", "pa", true, ADMIN)).rejects.toMatchObject({ statusCode: 403 });
    await expect(orgMemberService.assignToBranch("o1", "pa", "b1", undefined, ADMIN)).rejects.toMatchObject({ statusCode: 403 });
    await expect(orgMemberService.unassignFromBranch("o1", "pa", "b1", ADMIN)).rejects.toMatchObject({ statusCode: 403 });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
    expect(branchMemberRepository.setActiveForUser).not.toHaveBeenCalled();
    expect(branchMemberRepository.create).not.toHaveBeenCalled();
    expect(branchMemberRepository.removeFromBranch).not.toHaveBeenCalled();
  });
});

describe("setSuspended with no memberships", () => {
  it("400s on suspend (it would block nothing) but allows reactivate", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 0, active: 0 });

    await expect(orgMemberService.setSuspended("o1", "u2", true, ADMIN)).rejects.toMatchObject({
      statusCode: 400,
      message: "Assign this member to a branch before suspending",
    });
    expect(branchMemberRepository.setActiveForUser).not.toHaveBeenCalled();
    expect(userAccessService.revokeAccess).not.toHaveBeenCalled();
  });
});

describe("updateRole seat rule for referral partners", () => {
  it("checks a seat when a referral-only member becomes an internal role", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "r1", orgId: "o1", orgRole: "referral_agent" } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["referral_agent"] as never);
    vi.mocked(organizationSeatService.assertSeatAvailable).mockRejectedValueOnce(
      Object.assign(new Error("All 10 seats are in use"), { statusCode: 409 }),
    );

    await expect(orgMemberService.updateRole("o1", "r1", "agent", ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("allows it when a seat is free", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "r1", orgId: "o1", orgRole: "referral_agent" } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["referral_agent"] as never);
    await orgMemberService.updateRole("o1", "r1", "agent", ADMIN);
    expect(organizationSeatService.assertSeatAvailable).toHaveBeenCalledWith("o1");
    expect(branchMemberRepository.setOrgRoleAtomic).toHaveBeenCalledWith("o1", "r1", "agent");
  });

  it("does not check seats for seat-using members or when staying a referral partner", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "u2", orgId: "o1", orgRole: "agent" } as never);
    await orgMemberService.updateRole("o1", "u2", "branch_manager", ADMIN);

    vi.mocked(userRepository.findById).mockResolvedValue({ id: "r1", orgId: "o1", orgRole: "referral_agent" } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["referral_agent"] as never);
    await orgMemberService.updateRole("o1", "r1", "referral_agent", ADMIN);

    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();
  });
});

describe("updateProfile trims names", () => {
  it("trims names and phone and rejects names that are only spaces", async () => {
    const t = { id: "u2", orgId: "o1", role: "Agent", firstName: "Old", lastName: "Name", name: "Old Name" };
    vi.mocked(userRepository.findById).mockResolvedValue(t as never);
    vi.mocked(userRepository.update).mockResolvedValue(t as never);

    await orgMemberService.updateProfile("o1", "u2", { firstName: "  Ada ", phoneNumber: " 07000 000000 " }, ADMIN);
    expect(userRepository.update).toHaveBeenCalledWith("u2", {
      firstName: "Ada", lastName: "Name", name: "Ada Name", phoneNumber: "07000 000000",
    });

    await expect(orgMemberService.updateProfile("o1", "u2", { lastName: "   " }, ADMIN)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("updateRole seat rule: pending invites", () => {
  it("still checks the seat for a referral-only PENDING invite, even though its memberships are inactive", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "r1", orgId: "o1", orgRole: "referral_agent", inviteToken: "tok" } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["referral_agent"] as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });
    vi.mocked(organizationSeatService.assertSeatAvailable).mockRejectedValueOnce(
      Object.assign(new Error("All 10 seats are in use"), { statusCode: 409 }),
    );

    await expect(orgMemberService.updateRole("o1", "r1", "agent", ADMIN)).rejects.toMatchObject({ statusCode: 409 });
    expect(organizationSeatService.assertSeatAvailable).toHaveBeenCalledWith("o1");
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("exempts only a genuinely suspended accepted referral partner", async () => {
    vi.mocked(userRepository.findById).mockResolvedValue({ id: "r1", orgId: "o1", orgRole: "referral_agent", inviteToken: null } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["referral_agent"] as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });

    await orgMemberService.updateRole("o1", "r1", "agent", ADMIN);

    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();
  });
});
