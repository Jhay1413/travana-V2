import { describe, it, expect } from "vitest";
import {
  addDays, buildMonthCells, buildWeekCells, groupByDay, monthOf, monthTitle,
  moveKeepingTime, shiftMonth, weekRangeTitle, weekStart, DOW,
} from "./calendar-grid";

describe("month helpers", () => {
  it("monthOf / shiftMonth / monthTitle", () => {
    expect(monthOf("2026-10-15")).toBe("2026-10");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthTitle("2026-10")).toBe("October 2026");
    expect(DOW[0]).toBe("Mon");
  });
});

describe("addDays / weekStart", () => {
  it("adds across month and leap boundaries", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("finds Monday", () => {
    expect(weekStart("2026-10-15")).toBe("2026-10-12");
    expect(weekStart("2026-10-18")).toBe("2026-10-12");
    expect(weekStart("2026-10-12")).toBe("2026-10-12");
  });
});

describe("buildMonthCells", () => {
  it("handles a month starting on Sunday (March 2026)", () => {
    const cells = buildMonthCells("2026-03");
    expect(cells[0].iso).toBe("2026-02-23");
    expect(cells[0].inMonth).toBe(false);
    expect(cells[6].iso).toBe("2026-03-01");
    expect(cells[6].inMonth).toBe(true);
    expect(cells.length % 7).toBe(0);
  });
  it("handles a 28-day February that fits exactly four weeks", () => {
    const cells = buildMonthCells("2027-02"); // 1 Feb 2027 is a Monday
    expect(cells).toHaveLength(28);
    expect(cells.every((c) => c.inMonth)).toBe(true);
  });
  it("handles leap February", () => {
    const cells = buildMonthCells("2028-02");
    expect(cells.filter((c) => c.inMonth)).toHaveLength(29);
    expect(cells.length % 7).toBe(0);
  });
});

describe("week helpers", () => {
  it("buildWeekCells returns 7 days", () => {
    expect(buildWeekCells("2026-10-12").map((c) => c.day)).toEqual([12, 13, 14, 15, 16, 17, 18]);
  });
  it("weekRangeTitle same and cross month", () => {
    expect(weekRangeTitle("2026-10-13")).toBe("13 to 19 Oct 2026");
    expect(weekRangeTitle("2026-09-28")).toBe("28 Sep to 4 Oct 2026");
  });
});

describe("groupByDay", () => {
  it("groups by day and drops empty", () => {
    const m = groupByDay([{ d: "2026-10-15T09:00" }, { d: "2026-10-15T10:00" }, { d: null }], (i) => i.d);
    expect(m.get("2026-10-15")).toHaveLength(2);
    expect(m.size).toBe(1);
  });
});

describe("moveKeepingTime", () => {
  it("keeps the local time of day on the target day", () => {
    const original = new Date(2026, 9, 15, 9, 5).toISOString();
    expect(moveKeepingTime(original, "2026-10-20")).toBe("2026-10-20T09:05");
  });
});
