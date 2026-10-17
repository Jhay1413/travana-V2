import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./auth/storage", () => ({ authStorage: { getUser: vi.fn() } }));
vi.mock("../modules/branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserId: vi.fn(), findStandingByUserId: vi.fn() },
}));
vi.mock("../modules/user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findRolesByUserAndOrg: vi.fn() },
}));

import { orgBranchScope } from "./org-branch-scope";
import { authStorage } from "./auth/storage";
import { branchMemberRepository } from "../modules/branch-member/branch-member.repository";
import { userOrgRolesRepository } from "../modules/user-org-roles/user-org-roles.repository";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res;
}

async function run(userId: string, role: string) {
  vi.mocked(authStorage.getUser).mockResolvedValue({ id: userId, role: null, orgId: "org1", orgRole: role } as never);
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([role] as never);
  const req: any = { user: { id: userId }, session: {} };
  const next = vi.fn();
  await orgBranchScope(req, mockRes(), next);
  expect(next).toHaveBeenCalledOnce();
  return req;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 0, active: 0 } as never);
});

describe("orgBranchScope branch context", () => {
  it("homeworker owning their homeworker branch", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "hw1", orgRole: "homeworker", branchType: "homeworker", ownerUserId: "u1",
    } as never);
    const req = await run("u1", "homeworker");
    expect(req.branchId).toBe("hw1");
    expect(req.branchType).toBe("homeworker");
    expect(req.ownsHomeworkerBranch).toBe(true);
  });

  it("homeworker in the legacy shared branch does not own it", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "shared", orgRole: "homeworker", branchType: "homeworker", ownerUserId: null,
    } as never);
    const req = await run("u1", "homeworker");
    expect(req.branchType).toBe("homeworker");
    expect(req.ownsHomeworkerBranch).toBe(false);
  });

  it("homeworker branch owned by someone else is not owned", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "hw2", orgRole: "homeworker", branchType: "homeworker", ownerUserId: "u2",
    } as never);
    const req = await run("u1", "homeworker");
    expect(req.ownsHomeworkerBranch).toBe(false);
  });

  it("shop agent", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "b1", orgRole: "agent", branchType: "shop", ownerUserId: null,
    } as never);
    const req = await run("u1", "agent");
    expect(req.branchType).toBe("shop");
    expect(req.ownsHomeworkerBranch).toBe(false);
  });

  it("no membership leaves branchType null", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    const req = await run("u1", "org_admin");
    expect(req.branchId).toBeNull();
    expect(req.branchType).toBeNull();
    expect(req.ownsHomeworkerBranch).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Account standing: deactivated / suspended accounts lose their session.
// ---------------------------------------------------------------------------

function blockedReq(extra: Record<string, unknown> = {}) {
  const destroy = vi.fn((cb: () => void) => cb());
  const logout = vi.fn((cb: () => void) => cb());
  const req: any = { user: { userId: "u1", authType: "password" }, session: { destroy }, logout, ...extra };
  return { req, destroy, logout };
}

async function runBlocked(dbUser: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1", orgId: "org1", orgRole: "agent", role: null, ...dbUser } as never);
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"] as never);
  const { req, destroy, logout } = blockedReq(extra);
  const res = mockRes();
  const next = vi.fn();
  await orgBranchScope(req, res, next);
  return { req, res, next, destroy, logout };
}

describe("orgBranchScope account standing", () => {
  it("rejects a banned user with 401 + ACCOUNT_DEACTIVATED and destroys the session", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    const { res, next, destroy, logout } = await runBlocked({ banned: true });
    expect(next).not.toHaveBeenCalled();
    expect(logout).toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    expect(res.clearCookie).toHaveBeenCalledWith("connect.sid");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_DEACTIVATED" }));
    expect(branchMemberRepository.findActiveContextByUserId).not.toHaveBeenCalled();
  });

  it("rejects a banned platform admin too (before the platform-admin shortcut)", async () => {
    const { res, next } = await runBlocked({ banned: true, role: "platform_admin" });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_DEACTIVATED" }));
  });

  it("lets a platform admin impersonate an org exactly as before", async () => {
    const { req, next } = await runBlocked({ role: "platform_admin" }, { session: { impersonateOrgId: "orgX" } });
    expect(next).toHaveBeenCalledOnce();
    expect(req.orgId).toBe("orgX");
    expect(req.orgRole).toBe("org_admin");
    expect(branchMemberRepository.findStandingByUserId).not.toHaveBeenCalled();
  });

  it("rejects a suspended member (memberships exist, none active) with ACCOUNT_SUSPENDED", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 2, active: 0 } as never);
    const { res, next, destroy } = await runBlocked({});
    expect(next).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_SUSPENDED" }));
  });

  it("does not query the standing when an active membership context exists", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "b1", orgRole: "agent", branchType: "shop", ownerUserId: null,
    } as never);
    const { next } = await runBlocked({});
    expect(next).toHaveBeenCalledOnce();
    expect(branchMemberRepository.findStandingByUserId).not.toHaveBeenCalled();
  });

  it("lets a user with no memberships through via the org fallback", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 0, active: 0 } as never);
    const { req, next } = await runBlocked({});
    expect(next).toHaveBeenCalledOnce();
    expect(req.orgId).toBe("org1");
  });

  it("lets a pending invite through without querying the standing", async () => {
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    const { next } = await runBlocked({ inviteToken: "tok" });
    expect(next).toHaveBeenCalledOnce();
    expect(branchMemberRepository.findStandingByUserId).not.toHaveBeenCalled();
  });
});
