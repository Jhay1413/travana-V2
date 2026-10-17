import { describe, expect, it } from "vitest";
import { targetHrefForRole } from "./target-link";

describe("targetHrefForRole", () => {
  it("sends agency admins to the agency targets page", () => {
    expect(targetHrefForRole("org_admin")).toBe("/agency/targets");
    expect(targetHrefForRole("platform_admin")).toBe("/agency/targets");
  });

  it("sends branch managers to the branch targets page", () => {
    expect(targetHrefForRole("branch_manager")).toBe("/branch/targets");
  });

  it("sends homeworkers to My targets", () => {
    expect(targetHrefForRole("homeworker")).toBe("/my-targets");
  });

  it("gives everyone else no link", () => {
    expect(targetHrefForRole("agent")).toBeNull();
    expect(targetHrefForRole(null)).toBeNull();
  });
});
