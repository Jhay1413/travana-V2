import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";

vi.mock("./storage", () => ({ authStorage: { getUserByEmail: vi.fn(), getUser: vi.fn() } }));
vi.mock("./session", () => ({ isAuthenticated: vi.fn() }));
vi.mock("../../../controllers/registration.controller", () => ({ registrationController: {} }));
vi.mock("../../modules/branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserId: vi.fn(), findStandingByUserId: vi.fn() },
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

import { resolveOrgAndBranchForUser, loginHandler, currentUserHandler, updateProfileHandler } from "./require-auth";
import { authStorage } from "./storage";
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

// ---------------------------------------------------------------------------
// loginHandler / currentUserHandler: account standing
// ---------------------------------------------------------------------------

const hash = bcrypt.hashSync("correct-horse", 4);

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn(), clearCookie: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function loginReq(body: Record<string, unknown>) {
  const login = vi.fn((_u: unknown, cb: (err?: unknown) => void) => cb());
  return { req: { body, login, session: {} } as unknown as Request, login };
}

const baseUser = {
  id: "u1", email: "a@b.com", password: hash, emailVerified: true, banned: false,
  role: null, orgRole: "agent", orgId: "org1", inviteToken: null, resetToken: "secret-reset",
};

function stubLoginUser(found: Record<string, unknown> | undefined) {
  vi.mocked(authStorage.getUserByEmail).mockResolvedValue(found as never);
}

describe("loginHandler account standing", () => {
  it("refuses a banned user with 403 ACCOUNT_DEACTIVATED after the password check", async () => {
    stubLoginUser({ ...baseUser, banned: true });
    const { req, login } = loginReq({ email: "a@b.com", password: "correct-horse" });
    const res = mockRes();
    await loginHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Your account has been deactivated. Contact your agency admin.",
      code: "ACCOUNT_DEACTIVATED",
    });
    expect(login).not.toHaveBeenCalled();
  });

  it("refuses a suspended member with 403 ACCOUNT_SUSPENDED", async () => {
    stubLoginUser(baseUser);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });
    const { req, login } = loginReq({ email: "a@b.com", password: "correct-horse" });
    const res = mockRes();
    await loginHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Your account has been suspended. Contact your agency admin.",
      code: "ACCOUNT_SUSPENDED",
    });
    expect(login).not.toHaveBeenCalled();
  });

  it("gives the generic 401 for a wrong password without revealing the standing", async () => {
    stubLoginUser({ ...baseUser, banned: true });
    const { req } = loginReq({ email: "a@b.com", password: "nope" });
    const res = mockRes();
    await loginHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid email or password" });
  });

  it("checks standing before the unverified-email message", async () => {
    stubLoginUser({ ...baseUser, emailVerified: false });
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });
    const { req } = loginReq({ email: "a@b.com", password: "correct-horse" });
    const res = mockRes();
    await loginHandler(req, res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_SUSPENDED" }));
  });

  it("signs in an active member and never returns secrets", async () => {
    stubLoginUser(baseUser);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 1 });
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"]);
    const { req, login } = loginReq({ email: "a@b.com", password: "correct-horse" });
    const res = mockRes();
    await loginHandler(req, res as unknown as Response);
    await new Promise((resolve) => setImmediate(resolve));
    expect(login).toHaveBeenCalledOnce();
    const body = res.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.id).toBe("u1");
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("resetToken");
  });

  it("signs in a user with no memberships (legacy)", async () => {
    stubLoginUser(baseUser);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 0, active: 0 });
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([]);
    const { req, login } = loginReq({ email: "a@b.com", password: "correct-horse" });
    await loginHandler(req, mockRes() as unknown as Response);
    expect(login).toHaveBeenCalledOnce();
  });

  it("never blocks a platform admin on standing", async () => {
    stubLoginUser({ ...baseUser, role: "platform_admin" });
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([]);
    const { req, login } = loginReq({ email: "a@b.com", password: "correct-horse" });
    await loginHandler(req, mockRes() as unknown as Response);
    expect(login).toHaveBeenCalledOnce();
    expect(branchMemberRepository.findStandingByUserId).not.toHaveBeenCalled();
  });
});

describe("currentUserHandler account standing", () => {
  function userReq() {
    const destroy = vi.fn((cb: () => void) => cb());
    const logout = vi.fn((cb: () => void) => cb());
    return {
      req: { user: { authType: "password", userId: "u1" }, session: { destroy }, logout } as unknown as Request,
      destroy,
    };
  }

  it("answers 401 with the code and destroys the session for a suspended user", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue(baseUser as never);
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"]);
    vi.mocked(branchMemberRepository.findStandingByUserId).mockResolvedValue({ total: 1, active: 0 });
    const { req, destroy } = userReq();
    const res = mockRes();
    await currentUserHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_SUSPENDED" }));
    expect(destroy).toHaveBeenCalled();
  });

  it("returns the sanitized user for an active member without a standing query", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue(baseUser as never);
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
      orgId: "org1", branchId: "b1", orgRole: "agent", branchType: "shop", ownerUserId: null,
    } as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"]);
    const { req } = userReq();
    const res = mockRes();
    await currentUserHandler(req, res as unknown as Response);
    expect(branchMemberRepository.findStandingByUserId).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.branchId).toBe("b1");
    expect(body).not.toHaveProperty("password");
    expect(body).not.toHaveProperty("resetToken");
  });

  it("answers 401 for a banned user", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ ...baseUser, banned: true } as never);
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([]);
    const { req } = userReq();
    const res = mockRes();
    await currentUserHandler(req, res as unknown as Response);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_DEACTIVATED" }));
  });
});

describe("updateProfileHandler", () => {
  const updateUser = vi.fn();

  function run(body: Record<string, unknown>) {
    const req = { user: { authType: "password", userId: "u1" }, body, session: {} } as unknown as Request;
    return { req, res: mockRes() };
  }

  beforeEach(() => {
    updateUser.mockReset().mockResolvedValue({ ...baseUser, phoneNumber: "0777" });
    (authStorage as unknown as { updateUser: unknown }).updateUser = updateUser;
    vi.mocked(authStorage.getUser).mockResolvedValue({ ...baseUser, email: "Me@x.com" } as never);
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue([]);
  });

  it("refuses a different email with 400 and writes nothing", async () => {
    const { req, res } = run({ email: "other@x.com", phoneNumber: "0777" });
    await updateProfileHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Email can't be changed here. Ask your administrator." });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("treats the same email (any case) as a no-op and updates only the phone", async () => {
    const { req, res } = run({ email: "me@X.com", phoneNumber: " 0777 " });
    await updateProfileHandler(req, res as unknown as Response);
    expect(updateUser).toHaveBeenCalledWith("u1", { phoneNumber: "0777" });
    const body = res.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body).not.toHaveProperty("password");
  });

  it("ignores unknown fields such as role", async () => {
    const { req, res } = run({ phoneNumber: "0777", role: "platform_admin", orgRole: "org_admin" });
    await updateProfileHandler(req, res as unknown as Response);
    expect(updateUser).toHaveBeenCalledWith("u1", { phoneNumber: "0777" });
  });

  it("400s when there is nothing to update, and on an over-long phone", async () => {
    const empty = run({});
    await updateProfileHandler(empty.req, empty.res as unknown as Response);
    expect(empty.res.status).toHaveBeenCalledWith(400);

    const long = run({ phoneNumber: "1".repeat(41) });
    await updateProfileHandler(long.req, long.res as unknown as Response);
    expect(long.res.status).toHaveBeenCalledWith(400);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
