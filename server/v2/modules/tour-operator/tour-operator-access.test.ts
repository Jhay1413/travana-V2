import { describe, expect, it } from "vitest";
import { AppError } from "../../utils/error-handler";
import { canSeeOperatorPasswords, canWriteOperators, requireOrg, requireWriter } from "./tour-operator-access";

describe("tour-operator-access", () => {
  it("requireOrg fails closed with a 403", () => {
    expect(() => requireOrg({ orgId: "" })).toThrow(AppError);
    try {
      requireOrg({ orgId: "" });
    } catch (e) {
      expect((e as AppError).statusCode).toBe(403);
      expect((e as AppError).message).toBe("Select an organisation first");
    }
    expect(requireOrg({ orgId: "o1" })).toBe("o1");
  });

  it("writers and password viewers are platform_admin, org_admin and branch_manager", () => {
    for (const role of ["platform_admin", "org_admin", "branch_manager"] as const) {
      expect(canWriteOperators({ orgRoles: [role] })).toBe(true);
      expect(canSeeOperatorPasswords({ orgRoles: [role] })).toBe(true);
    }
    for (const role of ["agent", "homeworker", "social_media_manager", "referral_agent"] as const) {
      expect(canWriteOperators({ orgRoles: [role] })).toBe(false);
      expect(canSeeOperatorPasswords({ orgRoles: [role] })).toBe(false);
    }
  });

  it("a role held below the primary still counts (union)", () => {
    expect(canWriteOperators({ orgRoles: ["agent", "branch_manager"] })).toBe(true);
    expect(canWriteOperators({ orgRoles: [] })).toBe(false);
  });

  it("requireWriter throws 403 for an agent", () => {
    expect(() => requireWriter({ orgRoles: ["agent"] })).toThrow(AppError);
    expect(() => requireWriter({ orgRoles: ["org_admin"] })).not.toThrow();
  });
});
