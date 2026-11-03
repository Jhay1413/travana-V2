import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./organization-member-removal.repository", () => ({
  organizationMemberRemovalRepository: { countWorkload: vi.fn(), reassignAndDeactivate: vi.fn() },
}));
vi.mock("../user/user.repository", () => ({ userRepository: { findById: vi.fn() } }));
vi.mock("../user/user-access.service", () => ({ userAccessService: { revokeAccess: vi.fn() } }));
vi.mock("../branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserIdInOrg: vi.fn() },
}));
vi.mock("../user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findRolesByUserAndOrg: vi.fn() },
}));
vi.mock("./organization-audit.service", () => ({ organizationAuditService: { record: vi.fn() } }));

import { organizationMemberRemovalService } from "./organization-member-removal.service";
import { organizationMemberRemovalRepository as repo } from "./organization-member-removal.repository";
import { userRepository } from "../user/user.repository";
import { userAccessService } from "../user/user-access.service";
import { branchMemberRepository } from "../branch-member/branch-member.repository";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";
import { organizationAuditService } from "./organization-audit.service";

const ACTOR = { userId: "admin1", ipAddress: null, userAgent: null, impersonating: false };
const NO_WORK = { openDeals: 0, openTasks: 0, openTickets: 0, clients: 0 };
const SOME_WORK = { openDeals: 2, openTasks: 3, openTickets: 1, clients: 4 };

const target = { id: "u2", orgId: "o1", role: "Agent", orgRole: "agent", banned: false, inviteToken: null };
const owner = { id: "u3", orgId: "o1", role: "Agent", orgRole: "agent", banned: false, inviteToken: null };

function users(map: Record<string, unknown>) {
  vi.mocked(userRepository.findById).mockImplementation((async (id: string) => map[id]) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  users({ u2: target, u3: owner, admin1: { id: "admin1", name: "Alex Admin", orgId: "o1" } });
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([] as never);
  vi.mocked(repo.countWorkload).mockResolvedValue(NO_WORK);
  vi.mocked(repo.reassignAndDeactivate).mockResolvedValue(NO_WORK);
  vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({
    branchId: "b9", branchType: "shop",
  } as never);
});

describe("remove: guards", () => {
  it("refuses to remove yourself (400)", async () => {
    await expect(organizationMemberRemovalService.remove("o1", "admin1", {}, ACTOR)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.reassignAndDeactivate).not.toHaveBeenCalled();
  });

  it("404 when the target is not in the org", async () => {
    users({ u2: { ...target, orgId: "other" } });
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("400 for a platform admin", async () => {
    users({ u2: { ...target, role: "platform_admin" } });
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("409 with the platform-admin message when the user was deactivated by a platform admin", async () => {
    users({ u2: { ...target, banned: true, banReason: "Spam" } });
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({
      statusCode: 409,
      message: "This user is deactivated by a platform admin",
    });
    expect(repo.reassignAndDeactivate).not.toHaveBeenCalled();
  });

  it("409 when already removed", async () => {
    users({ u2: { ...target, banned: true, banReason: "Removed by Alex" } });
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("400 for a pending invite (revoke instead)", async () => {
    users({ u2: { ...target, inviteToken: "tok" } });
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({
      statusCode: 400,
      message: "Revoke the invite instead",
    });
  });

  it("400 for a homeworker (archived, not removed), including a legacy union", async () => {
    users({ u2: { ...target, orgRole: "homeworker" } });
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({
      statusCode: 400,
      message: "Homeworkers are archived, not removed",
    });

    users({ u2: target });
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent", "homeworker"] as never);
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("400 when work exists and no new owner is given", async () => {
    vi.mocked(repo.countWorkload).mockResolvedValue(SOME_WORK);
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.reassignAndDeactivate).not.toHaveBeenCalled();
  });

  it("counts clients as work that needs an owner", async () => {
    vi.mocked(repo.countWorkload).mockResolvedValue({ ...NO_WORK, clients: 1 });
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("remove: new owner eligibility", () => {
  beforeEach(() => vi.mocked(repo.countWorkload).mockResolvedValue(SOME_WORK));

  const attempt = (newOwnerId: string) =>
    organizationMemberRemovalService.remove("o1", "u2", { newOwnerId }, ACTOR);

  it("rejects the same person", async () => {
    await expect(attempt("u2")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a person from another org, a banned one, a pending invite and a platform admin", async () => {
    for (const bad of [
      { ...owner, orgId: "other" },
      { ...owner, banned: true },
      { ...owner, inviteToken: "t" },
      { ...owner, role: "platform_admin" },
    ]) {
      users({ u2: target, u3: bad });
      await expect(attempt("u3")).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(repo.reassignAndDeactivate).not.toHaveBeenCalled();
  });

  it("rejects roles that cannot hold the work (homeworker, referral, social media only)", async () => {
    for (const orgRole of ["homeworker", "referral_agent", "social_media_manager"]) {
      users({ u2: target, u3: { ...owner, orgRole } });
      await expect(attempt("u3")).rejects.toMatchObject({ statusCode: 400 });
    }
  });

  it("rejects an owner with no active branch or only a homeworker branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue(undefined as never);
    await expect(attempt("u3")).rejects.toMatchObject({ statusCode: 400 });

    vi.mocked(branchMemberRepository.findActiveContextByUserIdInOrg).mockResolvedValue({ branchId: "hb", branchType: "homeworker" } as never);
    await expect(attempt("u3")).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("remove: happy path", () => {
  it("hands over to the owner's branch, deactivates, then deletes sessions and audits", async () => {
    vi.mocked(repo.countWorkload).mockResolvedValue(SOME_WORK);
    const order: string[] = [];
    vi.mocked(repo.reassignAndDeactivate).mockImplementation(async () => { order.push("repo"); return SOME_WORK; });
    vi.mocked(userAccessService.revokeAccess).mockImplementation(async () => { order.push("sessions"); return 2; });
    vi.mocked(organizationAuditService.record).mockImplementation(async () => { order.push("audit"); });

    const result = await organizationMemberRemovalService.remove("o1", "u2", { newOwnerId: "u3" }, ACTOR);

    expect(repo.reassignAndDeactivate).toHaveBeenCalledWith({
      orgId: "o1", userId: "u2", newOwnerId: "u3", newOwnerBranchId: "b9", banReason: "Removed by Alex Admin",
    });
    expect(order).toEqual(["repo", "sessions", "audit"]);
    expect(userAccessService.revokeAccess).toHaveBeenCalledWith("u2");
    expect(result).toEqual({ userId: "u2", moved: SOME_WORK });
    expect(organizationAuditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "member.remove", orgId: "o1", targetUserId: "u2", metadata: { newOwnerId: "u3", moved: SOME_WORK, sessionsDeleted: 2 } }),
    );
  });

  it("removes someone with no open work without needing an owner", async () => {
    const result = await organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR);
    expect(repo.reassignAndDeactivate).toHaveBeenCalledWith(
      expect.objectContaining({ newOwnerId: null, newOwnerBranchId: null }),
    );
    expect(result.moved).toEqual(NO_WORK);
  });

  it("ignores a supplied owner when there is nothing to hand over", async () => {
    await organizationMemberRemovalService.remove("o1", "u2", { newOwnerId: "u3" }, ACTOR);
    expect(repo.reassignAndDeactivate).toHaveBeenCalledWith(expect.objectContaining({ newOwnerId: null }));
  });

  it("does NOT delete sessions or audit when the transaction fails (rolled back)", async () => {
    vi.mocked(repo.reassignAndDeactivate).mockRejectedValue(Object.assign(new Error("boom"), { statusCode: 409 }));
    await expect(organizationMemberRemovalService.remove("o1", "u2", {}, ACTOR)).rejects.toThrow("boom");
    expect(userAccessService.revokeAccess).not.toHaveBeenCalled();
    expect(organizationAuditService.record).not.toHaveBeenCalled();
  });
});

describe("getWorkload", () => {
  it("returns the counts for a member of the org", async () => {
    vi.mocked(repo.countWorkload).mockResolvedValue(SOME_WORK);
    await expect(organizationMemberRemovalService.getWorkload("o1", "u2")).resolves.toEqual(SOME_WORK);
    expect(repo.countWorkload).toHaveBeenCalledWith("o1", "u2");
  });

  it("404s for someone outside the org", async () => {
    users({ u2: { ...target, orgId: "other" } });
    await expect(organizationMemberRemovalService.getWorkload("o1", "u2")).rejects.toMatchObject({ statusCode: 404 });
  });
});
