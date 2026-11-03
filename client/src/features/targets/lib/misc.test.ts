import { describe, expect, it } from "vitest";
import { canEditAgentsIn, canEditShop, canRunAllocation, visibleTabs } from "./access";
import { buildAgentRows, filterSortAgents, statusCounts } from "./agent-rows";
import { barTone, monthCell, niceMax } from "./chart";
import { ownTarget } from "./homeworker";
import { makeYear } from "./targets-fixtures";

describe("access follows canEdit", () => {
  const bm = { business: false, shopBranchIds: [], agentBranchIds: ["hetton"], homeworkers: false, mine: false };
  it("branch manager edits agents in their shop only", () => {
    expect(canEditAgentsIn(bm, "hetton")).toBe(true);
    expect(canEditAgentsIn(bm, "durham")).toBe(false);
    expect(canEditShop(bm, "hetton")).toBe(false);
    expect(canRunAllocation(bm)).toBe(false);
  });
  it("hides Homeworkers unless allowed", () => {
    expect(visibleTabs(["business", "homeworkers"], bm)).toEqual(["business"]);
    expect(visibleTabs(["business", "homeworkers"], makeYear().canEdit)).toEqual(["business", "homeworkers"]);
  });
});

describe("chart", () => {
  it("colours bars and month cells", () => {
    expect(barTone(100, 100)).toBe("met");
    expect(barTone(99, 100)).toBe("missed");
    expect(monthCell(9, 10, 5, 3)).toEqual({ kind: "current" });
    expect(monthCell(10, 10, 5, 3)).toEqual({ kind: "future" });
    expect(monthCell(2, 10, 5, 8)).toEqual({ kind: "past", diff: -3 });
    // A finished year has no month to date.
    expect(monthCell(11, 12, 5, 3, 0)).toEqual({ kind: "past", diff: 2 });
  });
  it("rounds the ceiling", () => {
    expect(niceMax([100], [900])).toBe(1000);
    expect(niceMax([12000])).toBe(15000);
  });
});

describe("agent rows", () => {
  it("sorts behind first and counts statuses", () => {
    const data = makeYear();
    data.agents[0].actual = [20000]; // Sarah: 20k of 40k at 50% elapsed => ahead
    const rows = buildAgentRows(data);
    const sorted = filterSortAgents(rows, { branchId: "all", query: "", sort: "behind" });
    expect(sorted[sorted.length - 1].agent.userId).toBe("sarah");
    expect(statusCounts(rows)).toEqual({ ahead: 1, on_track: 0, behind: 2 });
    expect(filterSortAgents(rows, { branchId: "durham", query: "", sort: "name" })).toHaveLength(1);
    expect(filterSortAgents(rows, { branchId: "all", query: "tom", sort: "name" })).toHaveLength(1);
  });
});

describe("homeworker", () => {
  it("counts empty own months as zero", () => {
    expect(ownTarget({ selfMonths: [100, null, 50, ...Array(9).fill(null)] })).toBe(150);
  });
});
