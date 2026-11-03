import { describe, expect, it } from "vitest";
import { makeMember } from "./member-fixtures";
import { activeBranches, alsoSells, isHomeworkerMember, isSelf, memberStatus } from "./member-status";

describe("member-status", () => {
  it("is active with at least one active branch", () => {
    expect(memberStatus(makeMember())).toBe("active");
  });

  it("is suspended when banned or every branch is inactive", () => {
    expect(memberStatus(makeMember({ banned: true }))).toBe("suspended");
    expect(
      memberStatus(makeMember({ branches: [{ branchId: "b1", branchName: "Main", orgRole: "agent", isActive: false }] })),
    ).toBe("suspended");
  });

  it("treats a member without branches as active", () => {
    expect(memberStatus(makeMember({ branches: [] }))).toBe("active");
  });

  it("detects the signed-in user", () => {
    expect(isSelf(makeMember(), "u1")).toBe(true);
    expect(isSelf(makeMember(), "u2")).toBe(false);
    expect(isSelf(makeMember(), undefined)).toBe(false);
  });

  it("detects homeworkers", () => {
    expect(isHomeworkerMember(makeMember({ orgRole: "homeworker" }))).toBe(true);
    expect(isHomeworkerMember(makeMember())).toBe(false);
  });

  it("shows Also sells only for admins and branch managers who hold agent", () => {
    expect(alsoSells(makeMember({ orgRole: "org_admin", roles: ["org_admin", "agent"] }))).toBe(true);
    expect(alsoSells(makeMember({ orgRole: "branch_manager", roles: ["agent"] }))).toBe(true);
    expect(alsoSells(makeMember({ orgRole: "org_admin", roles: ["org_admin"] }))).toBe(false);
    expect(alsoSells(makeMember({ orgRole: "agent", roles: ["agent"] }))).toBe(false);
    expect(alsoSells(makeMember({ orgRole: "org_admin" }))).toBe(false);
  });

  it("lists only active branches", () => {
    const m = makeMember({
      branches: [
        { branchId: "b1", branchName: "A", orgRole: "agent", isActive: true },
        { branchId: "b2", branchName: "B", orgRole: "agent", isActive: false },
      ],
    });
    expect(activeBranches(m).map((b) => b.branchId)).toEqual(["b1"]);
  });
});
