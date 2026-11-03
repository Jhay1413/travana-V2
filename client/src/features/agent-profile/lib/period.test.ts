import { describe, expect, it } from "vitest";
import { addDays, daysBetween, daysInMonth, formatDay, formatRange, weekdayIndex } from "./dates";
import { buildPeriods, findPeriod, monthsOverlapping, shadedMonthKeys, yearsInWindow } from "./period";

const byKey = (todayKey: string) => Object.fromEntries(buildPeriods(todayKey).map((p) => [p.key, p]));

describe("dates", () => {
  it("does calendar maths on keys without the browser zone", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(weekdayIndex("2026-10-19")).toBe(0);
    expect(weekdayIndex("2026-10-25")).toBe(6);
  });

  it("formats days and ranges", () => {
    expect(formatDay("2026-10-05")).toBe("5 Oct 2026");
    expect(formatRange("2026-10-05", "2026-10-09")).toBe("5 Oct to 9 Oct 2026");
    expect(formatRange("2026-10-05", "2026-10-05")).toBe("5 Oct 2026");
    expect(formatRange("2026-12-30", "2027-01-02")).toBe("30 Dec 2026 to 2 Jan 2027");
  });
});

describe("buildPeriods", () => {
  it("resolves the quick choices on a Monday", () => {
    const p = byKey("2026-10-19");
    expect(p.today).toMatchObject({ from: "2026-10-19", to: "2026-10-20" });
    expect(p.week).toMatchObject({ from: "2026-10-19", to: "2026-10-26" });
    expect(p.month).toMatchObject({ from: "2026-10-01", to: "2026-11-01" });
  });

  it("starts the week on the Monday when today is a Sunday", () => {
    const p = byKey("2026-10-25");
    expect(p.week).toMatchObject({ from: "2026-10-19", to: "2026-10-26" });
    expect(p.lastweek).toMatchObject({ from: "2026-10-12", to: "2026-10-19" });
  });

  it("makes last 30 days and year to date end tomorrow so today counts", () => {
    const p = byKey("2026-10-19");
    expect(p.last30).toMatchObject({ from: "2026-09-20", to: "2026-10-20" });
    expect(daysBetween(p.last30.from, p.last30.to)).toBe(30);
    expect(p.ytd).toMatchObject({ from: "2026-01-01", to: "2026-10-20" });
  });

  it("rolls last month back across New Year in January", () => {
    const p = byKey("2027-01-05");
    expect(p.lastmonth).toMatchObject({ from: "2026-12-01", to: "2027-01-01" });
    expect(p.last30.from).toBe("2026-12-07");
    expect(p.month).toMatchObject({ from: "2027-01-01", to: "2027-02-01" });
  });

  it("handles a leap-year February and the day after it", () => {
    const p = byKey("2028-02-29");
    expect(p.month).toMatchObject({ from: "2028-02-01", to: "2028-03-01" });
    expect(p.today.to).toBe("2028-03-01");
    expect(byKey("2028-03-02").lastmonth).toMatchObject({ from: "2028-02-01", to: "2028-03-01" });
  });

  it("is not thrown by British Summer Time: bounds are plain London days", () => {
    const p = byKey("2026-03-29");
    expect(p.today).toMatchObject({ from: "2026-03-29", to: "2026-03-30" });
    expect(p.week).toMatchObject({ from: "2026-03-23", to: "2026-03-30" });
  });

  it("lists only quarters that have started, then each month to date", () => {
    const keys = buildPeriods("2026-10-19").map((p) => p.key);
    expect(keys).toContain("q4");
    expect(buildPeriods("2026-05-10").map((p) => p.key)).not.toContain("q3");

    expect(keys).toContain("2026-01");
    expect(keys).toContain("2026-10");
    expect(keys).not.toContain("2026-11");
    const q1 = byKey("2026-10-19").q1;
    expect(q1).toMatchObject({ from: "2026-01-01", to: "2026-04-01", label: "Q1 (January to March 2026)" });
    expect(byKey("2026-10-19")["2026-10"].label).toBe("October 2026");
  });

  it("falls back to this month for an unknown key", () => {
    const periods = buildPeriods("2026-10-19");
    expect(findPeriod(periods, "nonsense").key).toBe("month");
    expect(findPeriod(periods, "week").key).toBe("week");
  });
});

describe("monthsOverlapping", () => {
  it("counts the days a window spends in each month", () => {
    expect(monthsOverlapping("2026-10-26", "2026-11-03")).toEqual([
      { year: 2026, month: 10, days: 6, daysInMonth: 31 },
      { year: 2026, month: 11, days: 2, daysInMonth: 30 },
    ]);
  });

  it("crosses New Year", () => {
    const m = monthsOverlapping("2026-12-28", "2027-01-04");
    expect(m.map((x) => [x.year, x.month, x.days])).toEqual([
      [2026, 12, 4],
      [2027, 1, 3],
    ]);
    expect(yearsInWindow("2026-12-28", "2027-01-04")).toEqual([2026, 2027]);
    expect(shadedMonthKeys("2026-12-28", "2027-01-04")).toEqual(["2026-12", "2027-01"]);
  });

  it("gives a whole month exactly its own days", () => {
    expect(monthsOverlapping("2028-02-01", "2028-03-01")).toEqual([{ year: 2028, month: 2, days: 29, daysInMonth: 29 }]);
  });
});

import { dayKeyOf, londonClock } from "./dates";
import { buildHolidayModel } from "./holiday-model";

describe("dayKeyOf and londonClock", () => {
  it("keeps a plain date and converts a timestamp to its London day", () => {
    expect(dayKeyOf("2026-10-12")).toBe("2026-10-12");
    expect(dayKeyOf("2026-07-01T23:30:00.000Z")).toBe("2026-07-02");
    expect(dayKeyOf("2026-01-01T23:30:00.000Z")).toBe("2026-01-01");
  });

  it("shows no time for date-only values at London or UTC midnight", () => {
    expect(londonClock("2026-07-01T00:00:00.000Z")).toBeNull(); // 01:00 in BST
    expect(londonClock("2026-06-30T23:00:00.000Z")).toBeNull(); // London midnight in BST
    expect(londonClock("2026-07-01T08:00:00.000Z")).toBe("09:00");
  });
});

describe("holiday workingDays from the server", () => {
  it("prefers the server's count for a leave inside the year", () => {
    const m = buildHolidayModel({
      allowance: 28,
      todayKey: "2026-10-19",
      pattern: "mon-fri",
      leaves: [{ id: "x", type: "Annual", from: "2026-03-02", to: "2026-03-13", status: "Approved", workingDays: 9, createdAt: "2026-01-01" }],
    });
    expect(m.taken).toBe(9);
    expect(m.rows[0].days).toBe(9);
  });
});
