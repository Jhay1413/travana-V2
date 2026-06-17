import { describe, it, expect } from "vitest";
import { getScope, hasAnyRole } from "./scope";

describe("hasAnyRole — permission allowlist", () => {
  it("returns false for an empty or undefined role set", () => {
    expect(hasAnyRole(undefined, ["org_admin"])).toBe(false);
    expect(hasAnyRole([], ["org_admin"])).toBe(false);
  });

  it("returns true when the user holds any of the allowed roles", () => {
    expect(hasAnyRole(["agent", "branch_manager"], ["branch_manager"])).toBe(true);
  });

  it("returns false when none of the user's roles are allowed", () => {
    expect(hasAnyRole(["agent"], ["org_admin", "branch_manager"])).toBe(false);
  });
});

describe("getScope — request → scope mapping", () => {
  it("defaults orgRole to 'agent' but leaves orgRoles empty when no role is present", () => {
    // Asymmetry by design: orgRole has an 'agent' fallback, while orgRoles falls
    // back to the RAW req.orgRole (still undefined here) → []. Permission
    // allowlists keyed on orgRoles therefore see no roles for such a request.
    const req = { orgId: "o1", branchId: null } as never;

    const scope = getScope(req);

    expect(scope.orgRole).toBe("agent");
    expect(scope.orgRoles).toEqual([]);
  });

  it("passes through an explicit role union", () => {
    const req = { orgId: "o1", branchId: "b1", orgRole: "org_admin", orgRoles: ["org_admin", "agent"] } as never;

    const scope = getScope(req);

    expect(scope.orgRole).toBe("org_admin");
    expect(scope.orgRoles).toEqual(["org_admin", "agent"]);
  });

  it("resolves userId from a password-auth session", () => {
    const req = { orgId: "o1", branchId: null, user: { authType: "password", userId: "u1" } } as never;

    expect(getScope(req).userId).toBe("u1");
  });

  it("resolves userId from OIDC claims when not password auth", () => {
    const req = { orgId: "o1", branchId: null, user: { claims: { sub: "u-oidc" } } } as never;

    expect(getScope(req).userId).toBe("u-oidc");
  });

  it("yields a null userId when there is no authenticated user", () => {
    const req = { orgId: "o1", branchId: null } as never;

    expect(getScope(req).userId).toBeNull();
  });
});
