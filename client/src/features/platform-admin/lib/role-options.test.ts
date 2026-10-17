import { describe, it, expect } from "vitest";
import { addableRoles, isHomeworkerLocked } from "./role-options";

const ALL = ["org_admin", "branch_manager", "agent", "homeworker", "referral_agent", "social_media_manager"] as const;
const INTERNAL = new Set<string>(["org_admin", "branch_manager", "agent", "homeworker", "social_media_manager"]);

describe("addableRoles", () => {
  it("never offers homeworker", () => {
    expect(addableRoles(["agent"], ALL, INTERNAL)).not.toContain("homeworker");
    expect(addableRoles([], ALL, INTERNAL)).not.toContain("homeworker");
  });
  it("keeps referral exclusion rules", () => {
    expect(addableRoles(["agent"], ALL, INTERNAL)).not.toContain("referral_agent");
    expect(addableRoles(["referral_agent"], ALL, INTERNAL)).toEqual([]);
  });
  it("omits roles already held", () => {
    expect(addableRoles(["agent"], ALL, INTERNAL)).not.toContain("agent");
  });
});

describe("isHomeworkerLocked", () => {
  it("is true only when homeworker is held", () => {
    expect(isHomeworkerLocked(["homeworker"])).toBe(true);
    expect(isHomeworkerLocked(["agent", "homeworker"])).toBe(true);
    expect(isHomeworkerLocked(["agent"])).toBe(false);
  });
});
