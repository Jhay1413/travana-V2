import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./storage", () => ({ authStorage: { getUser: vi.fn() } }));
vi.mock("./resolve-account-block", () => ({ resolveAccountBlock: vi.fn() }));

import { requireActiveAccount } from "./require-active-account";
import { authStorage } from "./storage";
import { resolveAccountBlock } from "./resolve-account-block";
import type { Request, Response } from "express";

function setup() {
  const res = { status: vi.fn(), json: vi.fn(), clearCookie: vi.fn() };
  res.status.mockReturnValue(res);
  const req = {
    user: { authType: "password", userId: "u1" },
    logout: (cb: () => void) => cb(),
    session: { destroy: (cb: () => void) => cb() },
  } as unknown as Request;
  return { req, res, resTyped: res as unknown as Response, next: vi.fn() };
}

beforeEach(() => vi.clearAllMocks());

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
});
