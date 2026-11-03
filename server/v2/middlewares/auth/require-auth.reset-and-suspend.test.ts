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
  organizationRepository: { findById: vi.fn() },
}));
vi.mock("../../modules/branch/branch.repository", () => ({
  branchRepository: { findById: vi.fn().mockResolvedValue({ name: "Branch" }) },
}));
vi.mock("../../modules/user-org-roles/user-org-roles.repository", () => ({
  userOrgRolesRepository: { findRolesByUserAndOrg: vi.fn() },
}));
vi.mock("../../modules/user/password-reset.service", () => ({
  passwordResetService: { requestReset: vi.fn(), resetPassword: vi.fn() },
}));

import { loginHandler, currentUserHandler } from "./require-auth";
import { authStorage } from "./storage";
import { branchMemberRepository } from "../../modules/branch-member/branch-member.repository";
import { organizationRepository } from "../../modules/organization/organization.repository";
import { userOrgRolesRepository } from "../../modules/user-org-roles/user-org-roles.repository";

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
  role: null, orgRole: "agent", orgId: "org1", inviteToken: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
    orgId: "org1", branchId: "b1", orgRole: "agent", branchType: "shop", ownerUserId: null,
  } as never);
  vi.mocked(userOrgRolesRepository.findRolesByUserAndOrg).mockResolvedValue(["agent"]);
});

describe("suspended organisation", () => {
  const SUSPENDED = { message: "Your agency account has been suspended. Contact Travana support.", code: "ORG_SUSPENDED" };

  beforeEach(() => {
    vi.mocked(organizationRepository.findById).mockResolvedValue({ name: "Org", isActive: false } as never);
    vi.mocked(authStorage.getUserByEmail).mockResolvedValue(baseUser as never);
  });

  it("login is refused with 403 ORG_SUSPENDED and no session is created", async () => {
    const { req, login } = loginReq({ email: "a@b.com", password: "correct-horse" });
    const res = mockRes();
    await loginHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(SUSPENDED);
    expect(login).not.toHaveBeenCalled();
  });

  it("a wrong password still gets the generic 401 (the standing is not revealed)", async () => {
    const { req } = loginReq({ email: "a@b.com", password: "nope" });
    const res = mockRes();
    await loginHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("login works again once the organisation is active", async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue({ name: "Org", isActive: true } as never);
    const { req, login } = loginReq({ email: "a@b.com", password: "correct-horse" });
    await loginHandler(req, mockRes() as unknown as Response);
    expect(login).toHaveBeenCalledOnce();
  });

  it("a platform admin can log in regardless of any suspended org", async () => {
    vi.mocked(authStorage.getUserByEmail).mockResolvedValue({ ...baseUser, role: "platform_admin" } as never);
    const { req, login } = loginReq({ email: "a@b.com", password: "correct-horse" });
    await loginHandler(req, mockRes() as unknown as Response);
    expect(login).toHaveBeenCalledOnce();
  });

  it("an existing session gets 403 ORG_SUSPENDED from /api/auth/user without being destroyed", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue(baseUser as never);
    const destroy = vi.fn();
    const req = { user: { authType: "password", userId: "u1" }, session: { destroy } } as unknown as Request;
    const res = mockRes();
    await currentUserHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(SUSPENDED);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("a platform admin impersonating the suspended org still gets the user", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ ...baseUser, role: "platform_admin" } as never);
    const req = { user: { authType: "password", userId: "u1" }, session: { impersonateOrgId: "org1" } } as unknown as Request;
    const res = mockRes();
    await currentUserHandler(req, res as unknown as Response);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
  });

  it("a deactivated user in a suspended org gets the account block (session ended), not ORG_SUSPENDED", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ ...baseUser, banned: true } as never);
    const destroy = vi.fn((cb: () => void) => cb());
    const req = { user: { authType: "password", userId: "u1" }, session: { destroy } } as unknown as Request;
    const res = mockRes();
    await currentUserHandler(req, res as unknown as Response);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_DEACTIVATED" }));
    expect(destroy).toHaveBeenCalled();
  });
});
