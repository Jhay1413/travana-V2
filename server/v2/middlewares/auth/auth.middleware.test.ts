import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./storage", () => ({ authStorage: { getUser: vi.fn() } }));

import { requireOrgRole } from "./require-org-role";
import { requirePlatformAdmin } from "./require-platform-admin";
import { authStorage } from "./storage";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireOrgRole", () => {
  it("blocks a role not in the allowlist with 403", () => {
    const res = mockRes();
    const next = vi.fn();

    requireOrgRole(["org_admin"])({ orgRole: "agent" } as never, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for an allowed role", () => {
    const res = mockRes();
    const next = vi.fn();

    requireOrgRole(["org_admin", "agent"])({ orgRole: "agent" } as never, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("treats a missing role as unauthorised", () => {
    const res = mockRes();
    const next = vi.fn();

    requireOrgRole(["agent"])({} as never, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("requirePlatformAdmin", () => {
  it("returns 401 when there is no authenticated user", async () => {
    const res = mockRes();
    const next = vi.fn();

    await requirePlatformAdmin({} as never, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not a platform admin", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1", role: "org_admin" } as never);
    const res = mockRes();
    const next = vi.fn();

    await requirePlatformAdmin({ user: { authType: "password", userId: "u1" } } as never, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for a platform admin", async () => {
    vi.mocked(authStorage.getUser).mockResolvedValue({ id: "u1", role: "platform_admin" } as never);
    const res = mockRes();
    const next = vi.fn();

    await requirePlatformAdmin({ user: { authType: "password", userId: "u1" } } as never, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
