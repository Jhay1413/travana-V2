import { describe, expect, it } from "vitest";
import { makeHeader } from "./__fixtures__/agent-profile.fixtures";
import { buildPayoutViews, payoutsSubtitle } from "./payouts-model";
import { branchNames, buildPills, initialsOf, primaryRoleLabel } from "./pills";
import { PROFILE_TABS, breadcrumbFor, lockPaySentence, tabFromParam, tabPath, targetHref } from "./profile-tabs";

describe("pills", () => {
  it("shows the role, the branch and Employee for staff", () => {
    expect(buildPills(makeHeader())).toEqual({ role: "Agent", branches: ["Leeds"], engagement: "Employee" });
  });

  it("shows Self-employed homeworker and every active branch", () => {
    const h = makeHeader({
      isHomeworker: true,
      primaryRole: "homeworker",
      branches: [
        { id: "a", name: "Home", branchType: "homeworker", openingPattern: null, orgRole: "homeworker", isActive: true, joinedAt: "2026-01-01" },
        { id: "b", name: "Old shop", branchType: "shop", openingPattern: "mon-fri", orgRole: "agent", isActive: false, joinedAt: "2024-01-01" },
      ],
    });
    expect(buildPills(h)).toMatchObject({ role: "Homeworker", branches: ["Home"], engagement: "Self-employed homeworker" });
  });

  it("falls back to inactive branches and a neutral role", () => {
    const h = makeHeader({ primaryRole: null, branches: [{ id: "b", name: "Old shop", branchType: "shop", openingPattern: null, orgRole: "agent", isActive: false, joinedAt: "2024-01-01" }] });
    expect(branchNames(h)).toEqual(["Old shop"]);
    expect(primaryRoleLabel(null)).toBe("Team member");
    expect(primaryRoleLabel("platform_admin")).toBe("Platform admin");
    expect(primaryRoleLabel("branch_manager")).toBe("Branch Manager");
  });

  it("makes initials", () => {
    expect(initialsOf("Tina Baker")).toBe("TB");
    expect(initialsOf("  mason ")).toBe("M");
    expect(initialsOf("")).toBe("?");
  });
});

describe("profile tabs", () => {
  it("lists the five tabs with a lock on HR only", () => {
    expect(PROFILE_TABS.map((t) => t.value)).toEqual(["overview", "earnings", "training", "hr", "pipeline"]);
    expect(PROFILE_TABS.filter((t) => t.locked).map((t) => t.value)).toEqual(["hr"]);
  });

  it("maps a path segment to a tab and back", () => {
    expect(tabFromParam("earnings")).toBe("earnings");
    expect(tabFromParam("pipeline")).toBe("pipeline");
    expect(tabFromParam(undefined)).toBe("overview");
    expect(tabFromParam("bogus")).toBe("overview");
    expect(tabPath("u1", "overview")).toBe("/agents/u1");
    expect(tabPath("u1", "hr")).toBe("/agents/u1/hr");
    expect(tabPath("a b", "training")).toBe("/agents/a%20b/training");
  });

  it("sends admins to the Admin Dashboard and managers to their branch overview", () => {
    expect(breadcrumbFor(true)).toMatchObject({ rootLabel: "Admin Dashboard", parentLabel: "Team performance", rootHref: "/agency/overview" });
    expect(breadcrumbFor(false)).toMatchObject({ rootLabel: "Dashboard", parentLabel: "Agents", rootHref: "/branch-overview", parentHref: "/branch-overview" });
  });

  it("links the target button by viewer and engagement", () => {
    expect(targetHref(true, false)).toBe("/agency/targets/agents");
    expect(targetHref(true, true)).toBe("/agency/targets/homeworkers");
    expect(targetHref(false, false)).toBe("/branch/targets");
    expect(targetHref(false, true)).toBe("/branch/targets");
  });

  it("changes the lock sentence for viewers who cannot see pay", () => {
    expect(lockPaySentence(true)).toContain("for owners and admins only");
    expect(lockPaySentence(false)).toContain("hidden");
  });
});

describe("payouts", () => {
  const row = (over: Partial<Parameters<typeof buildPayoutViews>[0][number]>) => ({
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    gross: "1000.00",
    sharePercent: "70.00",
    homeworkerShare: "700.00",
    status: "paid" as const,
    finalisedAt: "2026-10-01T09:00:00.000Z",
    live: false,
    ...over,
  });

  it("turns statuses into words and tones", () => {
    const v = buildPayoutViews([row({}), row({ status: "draft", periodStart: "2026-08-01" }), row({ status: "due", live: true, periodStart: "2026-10-01" })]);
    expect(v.map((x) => [x.statusLabel, x.tone])).toEqual([
      ["Paid", "good"],
      ["Draft", "plain"],
      ["Due", "warn"],
    ]);
    expect(v[0]).toMatchObject({ month: "September 2026", amount: 700, sub: "70% to the homeworker" });
    expect(v[2]).toMatchObject({ month: "October 2026", sub: "Month so far", key: "2026-10-01-live" });
  });

  it("does not invent an amount", () => {
    expect(buildPayoutViews([row({ homeworkerShare: "" })])[0].amount).toBeNull();
  });

  it("states the split without a pay day", () => {
    expect(payoutsSubtitle("70.00")).toBe("Monthly, at a 70/30 split.");
    expect(payoutsSubtitle(null)).toBe("Monthly.");
    expect(payoutsSubtitle("abc")).toBe("Monthly.");
  });
});
