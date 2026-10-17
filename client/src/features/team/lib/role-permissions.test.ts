import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  MATRIX_ROLES,
  PERMISSION_COUNT,
  PERMISSION_GROUPS,
  permissionCount,
  roleDisplay,
  roleHasPermission,
} from "./role-permissions";

describe("role-permissions", () => {
  it("has 17 permissions in groups of 5, 3, 3 and 6", () => {
    expect(PERMISSION_COUNT).toBe(17);
    expect(PERMISSION_GROUPS.map((g) => g.items.length)).toEqual([5, 3, 3, 6]);
    expect(new Set(ALL_PERMISSIONS).size).toBe(17);
  });

  it("counts each role's defaults", () => {
    expect(permissionCount("org_admin")).toBe(17);
    expect(permissionCount("branch_manager")).toBe(15);
    expect(permissionCount("agent")).toBe(7);
    expect(permissionCount("social_media_manager")).toBe(3);
    expect(permissionCount("homeworker")).toBe(6);
  });

  it("counts 0 for referral partners and unknown roles", () => {
    expect(permissionCount("referral_agent")).toBe(0);
    expect(permissionCount("mystery")).toBe(0);
    expect(permissionCount(null)).toBe(0);
    expect(permissionCount(undefined)).toBe(0);
  });

  it("keeps billing and settings admin-only", () => {
    for (const role of MATRIX_ROLES) {
      expect(roleHasPermission(role, "billing")).toBe(role === "org_admin");
      expect(roleHasPermission(role, "settings")).toBe(role === "org_admin");
    }
  });

  it("homeworkers match agents without the AI assistant", () => {
    expect(roleHasPermission("agent", "ai")).toBe(true);
    expect(roleHasPermission("homeworker", "ai")).toBe(false);
    expect(roleHasPermission("homeworker", "book")).toBe(true);
  });

  it("labels roles, with the referral note", () => {
    expect(roleDisplay("org_admin").label).toBe("Owner / Admin");
    expect(roleDisplay("referral_agent").label).toBe("Referral partner");
    expect(roleDisplay("referral_agent").blurb).toBe("Referral hub only");
    expect(roleDisplay(null).label).toBe("Agent");
  });
});
