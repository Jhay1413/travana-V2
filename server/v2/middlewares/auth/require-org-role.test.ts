import { describe, it, expect, vi } from "vitest";
import { requireAnyOrgRole, requireOrgRole } from "./require-org-role";

function run(mw: ReturnType<typeof requireAnyOrgRole>, req: Record<string, unknown>) {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  const next = vi.fn();
  mw(req as never, res as never, next);
  return { res, next };
}

describe("requireAnyOrgRole", () => {
  const mw = requireAnyOrgRole(["homeworker"]);

  it("passes when the role is held anywhere in the union (primary is agent)", () => {
    const { next, res } = run(mw, { orgRole: "agent", orgRoles: ["agent", "homeworker"] });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("403s when none of the roles match", () => {
    const { next, res } = run(mw, { orgRole: "agent", orgRoles: ["agent"] });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("falls back to the primary role when the union is empty", () => {
    expect(run(mw, { orgRole: "homeworker", orgRoles: [] }).next).toHaveBeenCalled();
    expect(run(mw, { orgRoles: [] }).res.status).toHaveBeenCalledWith(403);
  });
});

describe("requireOrgRole (primary role only)", () => {
  it("does not see a role below the primary", () => {
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    const next = vi.fn();
    requireOrgRole(["homeworker"])({ orgRole: "agent", orgRoles: ["agent", "homeworker"] } as never, res as never, next);
    expect(next).not.toHaveBeenCalled();
  });
});
