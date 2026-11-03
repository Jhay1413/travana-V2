import { describe, expect, it } from "vitest";
import { londonDayStart, londonWeekStartKey, londonYearMonth } from "./london-day";

describe("londonYearMonth", () => {
  it("uses the London calendar, not UTC", () => {
    // 23:30 UTC on 30 June is already 1 July in London (BST).
    expect(londonYearMonth(new Date("2026-06-30T23:30:00Z"))).toEqual({ year: 2026, month: 7 });
    expect(londonYearMonth(new Date("2026-12-31T23:30:00Z"))).toEqual({ year: 2026, month: 12 });
    expect(londonYearMonth(new Date("2027-01-01T00:30:00Z"))).toEqual({ year: 2027, month: 1 });
  });
});

describe("london-day helpers", () => {
  it("londonDayStart is DST aware", () => {
    expect(londonDayStart("2026-03-29").toISOString()).toBe("2026-03-29T00:00:00.000Z");
    expect(londonDayStart("2026-03-30").toISOString()).toBe("2026-03-29T23:00:00.000Z");
    expect(londonDayStart("2026-10-25").toISOString()).toBe("2026-10-24T23:00:00.000Z");
    expect(londonDayStart("2026-10-26").toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });

  it("londonWeekStartKey returns the Monday", () => {
    expect(londonWeekStartKey("2026-10-12")).toBe("2026-10-12");
    expect(londonWeekStartKey("2026-10-16")).toBe("2026-10-12");
    expect(londonWeekStartKey("2026-10-18")).toBe("2026-10-12");
  });
});
