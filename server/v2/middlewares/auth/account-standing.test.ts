import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import {
  accountBlock,
  rejectBlockedSession,
  DEACTIVATED_BLOCK,
  SUSPENDED_BLOCK,
} from "./account-standing";
import { isRemovedUser, REMOVED_REASON_PREFIX } from "../../utils/removed-user";

describe("accountBlock", () => {
  it("blocks a banned user as deactivated", () => {
    expect(accountBlock({ banned: true }, { total: 1, active: 1 })).toBe(DEACTIVATED_BLOCK);
  });

  it("checks the ban before the platform-admin shortcut", () => {
    expect(accountBlock({ banned: true, role: "platform_admin" }, null)).toBe(DEACTIVATED_BLOCK);
  });

  it("always allows a platform admin who is not banned", () => {
    expect(accountBlock({ role: "platform_admin" }, { total: 3, active: 0 })).toBeNull();
  });

  it("allows a pending invite even though its memberships are inactive", () => {
    expect(accountBlock({ inviteToken: "tok" }, { total: 1, active: 0 })).toBeNull();
  });

  it("blocks a member with memberships but none active as suspended", () => {
    expect(accountBlock({}, { total: 2, active: 0 })).toBe(SUSPENDED_BLOCK);
  });

  it("allows a member with at least one active membership", () => {
    expect(accountBlock({}, { total: 2, active: 1 })).toBeNull();
  });

  it("allows a legacy user with no memberships at all", () => {
    expect(accountBlock({}, { total: 0, active: 0 })).toBeNull();
  });

  it("only applies the ban check when no standing was loaded", () => {
    expect(accountBlock({}, null)).toBeNull();
    expect(accountBlock({ banned: null }, null)).toBeNull();
  });

  it("uses the agreed messages and codes", () => {
    expect(DEACTIVATED_BLOCK).toEqual({
      code: "ACCOUNT_DEACTIVATED",
      message: "Your account has been deactivated. Contact your agency admin.",
    });
    expect(SUSPENDED_BLOCK).toEqual({
      code: "ACCOUNT_SUSPENDED",
      message: "Your account has been suspended. Contact your agency admin.",
    });
  });
});

describe("isRemovedUser", () => {
  it("is true only for banned users with a Removed by reason", () => {
    expect(isRemovedUser({ banned: true, banReason: `${REMOVED_REASON_PREFIX}Alex` })).toBe(true);
    expect(isRemovedUser({ banned: true, banReason: "Spam" })).toBe(false);
    expect(isRemovedUser({ banned: false, banReason: `${REMOVED_REASON_PREFIX}Alex` })).toBe(false);
    expect(isRemovedUser({ banned: true, banReason: null })).toBe(false);
  });
});

describe("rejectBlockedSession", () => {
  function setup(opts: { session?: boolean } = {}) {
    const destroy = vi.fn((cb: () => void) => cb());
    const logout = vi.fn((cb: () => void) => cb());
    const req = { logout, session: opts.session === false ? undefined : { destroy } } as unknown as Request;
    const res = { clearCookie: vi.fn(), status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    return { req, res, resTyped: res as unknown as Response, destroy, logout };
  }

  it("logs out, destroys the session, clears the cookie and answers 401 with the code", () => {
    const { req, res, resTyped, destroy, logout } = setup();
    rejectBlockedSession(req, resTyped, SUSPENDED_BLOCK);
    expect(logout).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect(res.clearCookie).toHaveBeenCalledWith("connect.sid");
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: SUSPENDED_BLOCK.message, code: "ACCOUNT_SUSPENDED" });
  });

  it("still answers when there is no session", () => {
    const { req, res, resTyped } = setup({ session: false });
    rejectBlockedSession(req, resTyped, DEACTIVATED_BLOCK);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: DEACTIVATED_BLOCK.message, code: "ACCOUNT_DEACTIVATED" });
  });
});
