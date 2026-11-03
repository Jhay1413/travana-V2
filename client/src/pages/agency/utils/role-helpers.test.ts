import { describe, it, expect } from "vitest";
import { roleOptionsForMember } from "./role-helpers";

describe("roleOptionsForMember", () => {
  it("excludes homeworker for non-homeworker members", () => {
    for (const role of ["agent", "branch_manager", null, undefined]) {
      expect(roleOptionsForMember(role).map((r) => r.value)).not.toContain("homeworker");
    }
  });
  it("lists homeworker for homeworker members so the select shows it", () => {
    expect(roleOptionsForMember("homeworker").map((r) => r.value)).toContain("homeworker");
  });
});
