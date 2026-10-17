import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("./storage", () => ({ authStorage: { getUser: vi.fn() } }));

import { requirePlatformAdmin } from "./require-platform-admin";
import { authStorage } from "./storage";

function setup() {
  const destroy = vi.fn((cb: () => void) => cb());
  const res = { status: vi.fn(), json: vi.fn(), clearCookie: vi.fn() };
  res.status.mockReturnValue(res);
  const req = {
    user: { authType: "password", userId: "pa1" },
    logout: (cb: () => void) => cb(),
    session: { destroy },
  } as unknown as Request;
  return { req, res, resTyped: res as unknown as Response, next: vi.fn(), destroy };
}

beforeEach(() => vi.clearAllMocks());

describe("requirePlatformAdmin", () => {
  it("lets an active platform admin through", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "pa1", role: "platform_admin", banned: false } as never);
    const { req, resTyped, next } = setup();
    await requirePlatformAdmin(req, resTyped, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a banned platform admin with 401 ACCOUNT_DEACTIVATED and destroys the session", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "pa1", role: "platform_admin", banned: true } as never);
    const { req, res, resTyped, next, destroy } = setup();
    await requirePlatformAdmin(req, resTyped, next);
    expect(next).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "ACCOUNT_DEACTIVATED" }));
  });

  it("403s a non-platform user", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1", role: "Agent", banned: false } as never);
    const { req, res, resTyped, next } = setup();
    await requirePlatformAdmin(req, resTyped, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
