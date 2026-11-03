import { describe, it, expect } from "vitest";
import { assertSubject, resolveAccess } from "./agent-profile.access";

const scope = (over: Record<string, unknown>) =>
  ({ orgId: "o1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "viewer", ...over }) as never;

describe("resolveAccess", () => {
  it("403s without an organisation, for every role", () => {
    for (const orgRole of ["org_admin", "platform_admin", "branch_manager"]) {
      expect(() => resolveAccess(scope({ orgRole, orgId: "", branchId: "b1" }))).toThrow(
        expect.objectContaining({ statusCode: 403, message: "Select an organisation first" }),
      );
    }
  });

  it("gives admins the whole organisation and the right to see pay", () => {
    expect(resolveAccess(scope({}))).toEqual({ orgId: "o1", branchId: null, isAdmin: true, canSeePay: true });
    expect(resolveAccess(scope({ orgRole: "platform_admin" }))).toMatchObject({ isAdmin: true, canSeePay: true });
  });

  it("limits a branch manager to their branch and hides pay", () => {
    expect(resolveAccess(scope({ orgRole: "branch_manager", branchId: "b1" }))).toEqual({
      orgId: "o1",
      branchId: "b1",
      isAdmin: false,
      canSeePay: false,
    });
  });

  it("403s a branch manager with no branch context", () => {
    expect(() => resolveAccess(scope({ orgRole: "branch_manager", branchId: null }))).toThrow(
      expect.objectContaining({ statusCode: 403, message: "No branch context" }),
    );
  });
});

describe("assertSubject", () => {
  const admin = { orgId: "o1", branchId: null, isAdmin: true, canSeePay: true };
  const manager = { orgId: "o1", branchId: "b1", isAdmin: false, canSeePay: false };

  it("404s when the subject has no membership in the organisation", () => {
    expect(() => assertSubject(admin, [])).toThrow(expect.objectContaining({ statusCode: 404, message: "Agent not found" }));
  });

  it("lets an admin open any member, whichever branch they sit in", () => {
    expect(() => assertSubject(admin, [{ branchId: "b9" }])).not.toThrow();
  });

  it("404s a branch manager for a member of another branch only", () => {
    expect(() => assertSubject(manager, [{ branchId: "b2" }])).toThrow(expect.objectContaining({ statusCode: 404 }));
    expect(() => assertSubject(manager, [{ branchId: "b2" }, { branchId: "b1" }])).not.toThrow();
  });
});
