import { describe, expect, it } from "vitest";
import type { AgentPerformanceRow } from "@/features/organization/api/organization-overview.api";
import {
  filterTeamRows,
  rowBranchLabel,
  rowPpb,
  showUnlistedRow,
  targetProgressPct,
  teamBranchId,
  teamFilterOptions,
  teamTotals,
  toGo,
} from "./team-math";

function agent(over: Partial<AgentPerformanceRow>): AgentPerformanceRow {
  return {
    id: "a",
    name: "Agent",
    firstName: "Agent",
    avatarUrl: null,
    today: 0,
    week: 0,
    month: 0,
    rangeBookings: 0,
    rangeCommission: 0,
    rangeSales: 0,
    rangeQuotes: 0,
    avgPerBooking: 0,
    target: 0,
    achievedPercent: 0,
    isHomeworker: false,
    branches: [],
    ...over,
  };
}

describe("team-math", () => {
  it("prefers the server ppb and falls back to month / bookings", () => {
    expect(rowPpb(agent({ ppb: 175, month: 999, rangeBookings: 3 }))).toBe(175);
    expect(rowPpb(agent({ month: 900, rangeBookings: 3 }))).toBe(300);
    expect(rowPpb(agent({ month: 900, rangeBookings: 0 }))).toBe(0);
  });

  it("computes to-go and progress", () => {
    expect(toGo(5000, 2278)).toBe(2722);
    expect(toGo(1000, 1500)).toBe(0);
    expect(targetProgressPct(5000, 2278)).toBe(46);
    expect(targetProgressPct(0, 100)).toBe(0);
  });

  it("totals rows and averages by bookings", () => {
    const rows = [
      agent({ id: "1", today: 10, week: 100, month: 600, rangeBookings: 3, target: 1000, openDeals: 4 }),
      agent({ id: "2", today: 0, week: 50, month: 300, rangeBookings: 3, target: 0, openDeals: 2 }),
    ];
    expect(teamTotals(rows, undefined, true)).toEqual({
      today: 10,
      week: 150,
      month: 900,
      bookings: 6,
      avg: 150,
      target: 1000,
      toGo: 400,
      openDeals: 6,
    });
  });

  it("sums each targeted agent's own shortfall", () => {
    const rows = [agent({ id: "a", month: 0, target: 10000 }), agent({ id: "b", month: 15000, target: 0 })];
    expect(teamTotals(rows, undefined, false)).toMatchObject({ target: 10000, toGo: 10000 });
  });

  it("adds the unlisted row only when asked", () => {
    const rows = [agent({ month: 600, rangeBookings: 3 })];
    const unlisted = { today: 5, week: 20, month: 300, rangeBookings: 3 };
    expect(teamTotals(rows, unlisted, true)).toMatchObject({ month: 900, bookings: 6, avg: 150, today: 5, week: 20 });
    expect(teamTotals(rows, unlisted, false)).toMatchObject({ month: 600, bookings: 3, avg: 200 });
  });

  it("reports null open deals when the server does not send them", () => {
    expect(teamTotals([agent({})], undefined, false).openDeals).toBeNull();
  });

  it("shows the unlisted row for the unfiltered team with profit", () => {
    expect(showUnlistedRow({ today: 0, week: 0, month: 10, rangeBookings: 1 }, "all")).toBe(true);
    expect(showUnlistedRow({ today: 0, week: 0, month: 0, rangeBookings: 0 }, "all")).toBe(false);
    expect(showUnlistedRow({ today: 0, week: 0, month: 10, rangeBookings: 1 }, "homeworkers")).toBe(false);
    expect(showUnlistedRow(undefined, "all")).toBe(false);
  });

  it("builds filter options", () => {
    const branches = [
      { id: "b1", name: "Shop One", branchType: "shop" },
      { id: "h1", name: "Home", branchType: "homeworker" },
    ];
    expect(teamFilterOptions(branches, false)).toEqual([
      { value: "all", label: "All branches" },
      { value: "shop", label: "Shop staff" },
      { value: "branch:b1", label: "Shop One" },
      { value: "homeworkers", label: "Homeworkers" },
    ]);
    expect(teamFilterOptions(branches, true).map((o) => o.value)).toEqual(["all", "shop", "homeworkers"]);
  });

  it("resolves the branch to query", () => {
    expect(teamBranchId("page", "all")).toBe("page");
    expect(teamBranchId(undefined, "branch:b1")).toBe("b1");
    expect(teamBranchId(undefined, "homeworkers")).toBeUndefined();
  });

  it("filters homeworkers client-side", () => {
    const rows = [agent({ id: "1" }), agent({ id: "2", isHomeworker: true }), agent({ id: "3", branchType: "homeworker" })];
    expect(filterTeamRows(rows, "homeworkers").map((r) => r.id)).toEqual(["2", "3"]);
    expect(filterTeamRows(rows, "shop").map((r) => r.id)).toEqual(["1"]);
    expect(filterTeamRows(rows, "all")).toHaveLength(3);
    expect(filterTeamRows(rows, "branch:x")).toHaveLength(3);
  });

  it("labels the branch line", () => {
    expect(rowBranchLabel(agent({ branches: [{ id: "1", name: "Shop One", code: null }] }))).toBe("Shop One");
    expect(rowBranchLabel(agent({ isHomeworker: true }))).toBe("Homeworker");
    expect(rowBranchLabel(agent({}))).toBe("No branch");
  });
});
