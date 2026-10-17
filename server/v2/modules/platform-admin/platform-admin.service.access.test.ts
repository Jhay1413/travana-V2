import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./platform-admin.repository", () => ({
  platformAdminRepository: {
    findUserByIdAcrossOrgs: vi.fn(),
    findOrgByIdWithCounts: vi.fn(),
    setUserBanned: vi.fn(),
    updatePlan: vi.fn(),
  },
}));
vi.mock("./platform-admin-audit.repository", () => ({ platformAdminAuditRepository: { create: vi.fn() } }));
vi.mock("../user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findRolesByUserAndOrg: vi.fn() },
}));
vi.mock("../branch-member/branch-member.repository", () => ({ branchMemberRepository: { setOrgRoleAtomic: vi.fn() } }));
vi.mock("../user/user-access.service", () => ({ userAccessService: { revokeAccess: vi.fn() } }));
vi.mock("../organization/organization-seat.service", () => ({ organizationSeatService: { assertSeatAvailable: vi.fn() } }));
vi.mock("../plan/plan.repository", () => ({ planRepository: { findByCode: vi.fn() } }));

import { platformAdminService } from "./platform-admin.service";
import { platformAdminRepository } from "./platform-admin.repository";
import { platformAdminAuditRepository } from "./platform-admin-audit.repository";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";
import { userAccessService } from "../user/user-access.service";
import { organizationSeatService } from "../organization/organization-seat.service";
import { planRepository } from "../plan/plan.repository";

const ACTOR = { userId: "pa1", ipAddress: null, userAgent: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([] as never);
});

describe("platformAdminService.deactivateUser", () => {
  it("revokes sessions and realtime after the ban and records the count in the audit row", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({ id: "u1", orgId: "o1" } as never);
    vi.mocked(userAccessService.revokeAccess).mockResolvedValue(2);

    await platformAdminService.deactivateUser("o1", "u1", ACTOR, "abuse");

    expect(platformAdminRepository.setUserBanned).toHaveBeenCalledWith("u1", "o1", true, "abuse");
    expect(userAccessService.revokeAccess).toHaveBeenCalledWith("u1");
    expect(vi.mocked(platformAdminAuditRepository.create).mock.calls[0][0]).toMatchObject({
      action: "user.deactivate",
      metadata: { reason: "abuse", sessionsDeleted: 2 },
    });
  });

  it("does not touch sessions when the user is not in the org", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({ id: "u1", orgId: "other" } as never);
    await expect(platformAdminService.deactivateUser("o1", "u1", ACTOR)).rejects.toMatchObject({ statusCode: 404 });
    expect(userAccessService.revokeAccess).not.toHaveBeenCalled();
  });
});

describe("platformAdminService.changePlan", () => {
  beforeEach(() => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue({ id: "o1", plan: "starter", seatLimit: 10 } as never);
  });

  it("sets seatLimit from the plan when none is given", async () => {
    vi.mocked(planRepository.findByCode).mockResolvedValue({ code: "growth", seatLimit: 30 } as never);
    await platformAdminService.changePlan("o1", "growth", undefined, ACTOR);
    expect(platformAdminRepository.updatePlan).toHaveBeenCalledWith("o1", "growth", 30);
  });

  it("uses null (unlimited) when the plan has no cap", async () => {
    vi.mocked(planRepository.findByCode).mockResolvedValue({ code: "enterprise", seatLimit: null } as never);
    await platformAdminService.changePlan("o1", "enterprise", undefined, ACTOR);
    expect(platformAdminRepository.updatePlan).toHaveBeenCalledWith("o1", "enterprise", null);
  });

  it("keeps an explicit seatLimit", async () => {
    await platformAdminService.changePlan("o1", "growth", 99, ACTOR);
    expect(planRepository.findByCode).not.toHaveBeenCalled();
    expect(platformAdminRepository.updatePlan).toHaveBeenCalledWith("o1", "growth", 99);
  });
});

describe("platformAdminService.changeUserOrgRole - seats", () => {
  it("takes a seat when a referral-only user becomes an internal role", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({ id: "u1", orgId: "o1", orgRole: "referral_agent" } as never);
    vi.mocked(organizationSeatService.assertSeatAvailable).mockRejectedValueOnce(
      Object.assign(new Error("All 10 seats are in use"), { statusCode: 409 }),
    );
    await expect(platformAdminService.changeUserOrgRole("o1", "u1", "agent", ACTOR)).rejects.toMatchObject({ statusCode: 409 });
    expect(branchMemberRepository.setOrgRoleAtomic).not.toHaveBeenCalled();
  });

  it("does not seat-check changes between seat-using roles", async () => {
    vi.mocked(platformAdminRepository.findUserByIdAcrossOrgs).mockResolvedValue({ id: "u1", orgId: "o1", orgRole: "agent" } as never);
    await platformAdminService.changeUserOrgRole("o1", "u1", "branch_manager", ACTOR);
    expect(organizationSeatService.assertSeatAvailable).not.toHaveBeenCalled();
  });
});
