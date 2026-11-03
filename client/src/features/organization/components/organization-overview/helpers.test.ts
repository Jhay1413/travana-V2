import { describe, it, expect } from "vitest";
import { filterOverviewRows, isHomeworkerRow } from "./helpers";

describe("overview row filter", () => {
  const rows = [
    { id: "shop", branchType: "shop" as const },
    { id: "hw", branchType: "homeworker" as const },
    { id: "legacy-hw", isHomeworker: true },
    { id: "legacy-agent", isHomeworker: false },
    // branchType wins over the legacy flag
    { id: "conflict", branchType: "shop" as const, isHomeworker: true },
  ];

  it("prefers branchType, falls back to isHomeworker", () => {
    expect(rows.map(isHomeworkerRow)).toEqual([false, true, true, false, false]);
  });
  it("branches filter drops homeworkers", () => {
    expect(filterOverviewRows(rows, "branches").map((r) => r.id)).toEqual(["shop", "legacy-agent", "conflict"]);
  });
  it("homeworkers filter keeps only homeworkers", () => {
    expect(filterOverviewRows(rows, "homeworkers").map((r) => r.id)).toEqual(["hw", "legacy-hw"]);
  });
  it("all keeps everything", () => {
    expect(filterOverviewRows(rows, "all")).toHaveLength(5);
  });
});
