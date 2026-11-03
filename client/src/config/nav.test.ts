import { describe, it, expect } from "vitest";
import { getNavForRole, isNavItem, type NavItem, type NavSection } from "./nav";

function paths(role: Parameters<typeof getNavForRole>[0]): string[] {
  return getNavForRole(role).flatMap((s) => s.items.filter(isNavItem).map((i) => i.path));
}

function allPaths(role: Parameters<typeof getNavForRole>[0]): string[] {
  const walk = (entries: Array<NavItem | NavSection>): string[] =>
    entries.flatMap((e) => (isNavItem(e) ? [e.path] : walk(e.items)));
  return walk(getNavForRole(role).flatMap((s) => s.items));
}

describe("homeworkers admin nav", () => {
  it("is offered to org_admin", () => {
    expect(allPaths("org_admin")).toContain("/agency/homeworkers");
  });

  it.each(["agent", "homeworker", "branch_manager", "platform_admin", "referral_agent", "social_media_manager"] as const)(
    "is not offered to %s",
    (role) => {
      expect(allPaths(role)).not.toContain("/agency/homeworkers");
    },
  );
});

describe("departures nav", () => {
  it.each(["org_admin", "branch_manager"] as const)("is offered to %s", (role) => {
    expect(allPaths(role)).toContain("/agency/departures");
  });

  it.each(["agent", "homeworker", "referral_agent", "social_media_manager"] as const)("is not offered to %s", (role) => {
    expect(allPaths(role)).not.toContain("/agency/departures");
  });
});

describe("tour operators nav", () => {
  it.each(["org_admin", "branch_manager", "agent", "homeworker"] as const)("offers the page to %s", (role) => {
    expect(allPaths(role)).toContain("/agency/tour-operators");
  });

  it.each(["social_media_manager", "referral_agent"] as const)("does not offer the page to %s", (role) => {
    expect(allPaths(role)).not.toContain("/agency/tour-operators");
  });

  it("keeps the global catalogue for platform admins only", () => {
    expect(allPaths("platform_admin")).toContain("/settings/tour-operators");
    expect(allPaths("org_admin")).not.toContain("/settings/tour-operators");
    expect(allPaths("org_admin")).toContain("/settings/tags");
  });
});

describe("homeworker nav", () => {
  it("offers My Statement to homeworkers only", () => {
    expect(paths("homeworker")).toContain("/my-statement");
    expect(paths("agent")).not.toContain("/my-statement");
  });

  it("offers My Targets to homeworkers only", () => {
    expect(paths("homeworker")).toContain("/my-targets");
    for (const role of ["agent", "branch_manager", "referral_agent", "social_media_manager"] as const) {
      expect(allPaths(role)).not.toContain("/my-targets");
    }
    expect(allPaths("org_admin")).not.toContain("/my-targets");
  });

  it("hides Social Posts and Inbox", () => {
    const p = paths("homeworker");
    expect(p).not.toContain("/social-posts");
    expect(p).not.toContain("/conversations");
  });

  it("keeps the rest of the agent nav", () => {
    expect(paths("homeworker")).toContain("/pipeline");
  });

  it.each(["agent", "homeworker", "branch_manager", "org_admin", "platform_admin", "referral_agent", "social_media_manager"] as const)(
    "has no /tasks entry for %s (the My Tasks page was removed)",
    (role) => {
      expect(paths(role)).not.toContain("/tasks");
    },
  );

  it("leaves the agent nav untouched", () => {
    expect(paths("agent")).toContain("/social-posts");
    expect(paths("agent")).toContain("/conversations");
  });
});

describe("social media manager nav", () => {
  it("offers Social Posts", () => {
    expect(paths("social_media_manager")).toContain("/social-posts");
    expect(paths("social_media_manager")).not.toContain("/conversations");
  });

  it("does not offer the Dashboard, which the role cannot access", () => {
    expect(paths("social_media_manager")).not.toContain("/agent-overview");
  });

  it("does not offer Pipeline, which the role cannot access", () => {
    expect(paths("social_media_manager")).not.toContain("/pipeline");
    expect(paths("agent")).toContain("/pipeline");
    expect(paths("homeworker")).toContain("/pipeline");
  });
});
