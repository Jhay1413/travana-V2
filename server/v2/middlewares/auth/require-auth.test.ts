import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./storage", () => ({ authStorage: {} }));
vi.mock("./session", () => ({ isAuthenticated: vi.fn() }));
vi.mock("../../../controllers/registration.controller", () => ({ registrationController: {} }));
vi.mock("../../modules/branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserId: vi.fn() },
}));
vi.mock("../../modules/organization/organization.repository", () => ({
  organizationRepository: { findById: vi.fn().mockResolvedValue({ name: "Org" }) },
}));
vi.mock("../../modules/branch/branch.repository", () => ({
  branchRepository: { findById: vi.fn().mockResolvedValue({ name: "Branch" }) },
}));
vi.mock("../../modules/user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findRolesByUserAndOrg: vi.fn() },
}));

import { resolveOrgAndBranchForUser } from "./require-auth";
import { branchMemberRepository } from "../../modules/branch-member/branch-member.repository";
import { userOrgRolesRepository } from "../../modules/user-org-roles/user-org-roles.repository";

beforeEach(() => vi.clearAllMocks());

const user = { id: "u1", role: null, orgRole: "homeworker", orgId: "org1" };

describe("resolveOrgAndBranchForUser branch context", () => {
  it("flags ownership of a homeworker branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "hw1", orgRole: "homeworker", branchType: "homeworker", ownerUserId: "u1",
    } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["homeworker"] as never);
    const ctx = await resolveOrgAndBranchForUser(user);
    expect(ctx.branchType).toBe("homeworker");
    expect(ctx.ownsHomeworkerBranch).toBe(true);
    expect(ctx.branchId).toBe("hw1");
  });

  it("legacy shared homeworker branch is not owned", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "shared", orgRole: "homeworker", branchType: "homeworker", ownerUserId: null,
    } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["homeworker"] as never);
    const ctx = await resolveOrgAndBranchForUser(user);
    expect(ctx.branchType).toBe("homeworker");
    expect(ctx.ownsHomeworkerBranch).toBe(false);
  });

  it("shop member", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "b1", orgRole: "agent", branchType: "shop", ownerUserId: null,
    } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"] as never);
    const ctx = await resolveOrgAndBranchForUser({ ...user, orgRole: "agent" });
    expect(ctx.branchType).toBe("shop");
    expect(ctx.ownsHomeworkerBranch).toBe(false);
  });

  it("no membership and platform_admin have no branch type", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([] as never);
    const none = await resolveOrgAndBranchForUser(user);
    expect(none.branchType).toBeNull();
    const admin = await resolveOrgAndBranchForUser({ id: "p", role: "platform_admin" });
    expect(admin.branchType).toBeNull();
    expect(admin.ownsHomeworkerBranch).toBe(false);
  });
});
