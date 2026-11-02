import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./storage", () => ({ authStorage: { getUser: vi.fn() } }));
vi.mock("./resolve-account-block", () => ({ resolveAccountBlock: vi.fn() }));
vi.mock("../../modules/branch-member/branch-member.repository", () => ({
  branchMemberRepository: { findActiveContextByUserId: vi.fn() },
}));
vi.mock("../../modules/organization/organization.repository", () => ({
  organizationRepository: { findById: vi.fn() },
}));

import { requireActiveAccount } from "./require-active-account";
import { authStorage } from "./storage";
import { resolveAccountBlock } from "./resolve-account-block";
import { branchMemberRepository } from "../../modules/branch-member/branch-member.repository";
import { organizationRepository } from "../../modules/organization/organization.repository";
import type { Request, Response } from "express";

const SUSPENDED = { message: "Your agency account has been suspended. Contact Travana support.", code: "ORG_SUSPENDED" };

function setup() {
  const destroy = vi.fn((cb: () => void) => cb());
  const res = { status: vi.fn(), json: vi.fn(), clearCookie: vi.fn() };
  res.status.mockReturnValue(res);
  const req = {
    user: { authType: "password", userId: "u1" },
    logout: (cb: () => void) => cb(),
    session: { destroy },
  } as unknown as Request;
  return { req, res, destroy, resTyped: res as unknown as Response, next: vi.fn() };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({
    orgId: "org1", orgIsActive: true,
  } as never);
});

describe("requireActiveAccount", () => {
  it("lets an active account through", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(resolveAccountBlock).mockResolvedValue(null);
    const { req, resTyped, next } = setup();
    await requireActiveAccount(req, resTyped, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a blocked account with 401 + code and ends the session", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1" } as never);
    vi.mocked(resolveAccountBlock).mockResolvedValue({ code: "ACCOUNT_SUSPENDED", message: "m" });
    const { req, res, resTyped, next } = setup();
    await requireActiveAccount(req, resTyped, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "m", code: "ACCOUNT_SUSPENDED" });
  });

  it("401s when the user no longer exists", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue(undefined);
    const { req, res, resTyped, next } = setup();
    await requireActiveAccount(req, resTyped, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 403 ORG_SUSPENDED for staff of a suspended organisation and keeps the session", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1", role: null } as never);
    vi.mocked(resolveAccountBlock).mockResolvedValue(null);
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({ orgId: "org1", orgIsActive: false } as never);
    const { req, res, destroy, resTyped, next } = setup();
    await requireActiveAccount(req, resTyped, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(SUSPENDED);
    expect(destroy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("looks the organisation up for a user with no active membership (legacy orgId)", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1", role: null, orgId: "org9" } as never);
    vi.mocked(resolveAccountBlock).mockResolvedValue(null);
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue(undefined as never);
    vi.mocked(organizationRepository.findById).mockResolvedValue({ isActive: false } as never);
    const { req, res, resTyped, next } = setup();
    await requireActiveAccount(req, resTyped, next);
    expect(organizationRepository.findById).toHaveBeenCalledWith("org9");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("exempts platform admins from the organisation check", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1", role: "platform_admin", orgId: "org1" } as never);
    vi.mocked(resolveAccountBlock).mockResolvedValue(null);
    vi.mocked(organizationRepository.findById).mockResolvedValue({ isActive: false } as never);
    const { req, resTyped, next } = setup();
    await requireActiveAccount(req, resTyped, next);
    expect(next).toHaveBeenCalledWith();
    expect(organizationRepository.findById).not.toHaveBeenCalled();
  });

  it("runs the account block before the organisation check", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1", role: null } as never);
    vi.mocked(resolveAccountBlock).mockResolvedValue({ code: "ACCOUNT_DEACTIVATED", message: "d" });
    vi.mocked(branchMemberRepository.findActiveContextByUserId).mockResolvedValue({ orgId: "org1", orgIsActive: false } as never);
    const { req, res, resTyped, next } = setup();
    await requireActiveAccount(req, resTyped, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "d", code: "ACCOUNT_DEACTIVATED" });
    expect(next).not.toHaveBeenCalled();
  });
});
