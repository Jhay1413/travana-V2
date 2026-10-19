import { describe, it, expect } from "vitest";
import {
  countWorkingDays,
  currentLondonYear,
  holidayWorkingDaysInYear,
  isWorkingDayOfWeek,
  toOpeningPattern,
} from "./leave-days";

describe("toOpeningPattern", () => {
  it("keeps known patterns and defaults the rest to mon-fri", () => {
    expect(toOpeningPattern("mon-sat")).toBe("mon-sat");
    expect(toOpeningPattern("seven-days")).toBe("seven-days");
    expect(toOpeningPattern("mon-fri")).toBe("mon-fri");
    expect(toOpeningPattern(null)).toBe("mon-fri");
    expect(toOpeningPattern("weird")).toBe("mon-fri");
  });
});

describe("isWorkingDayOfWeek", () => {
  it("follows the opening pattern", () => {
    expect(isWorkingDayOfWeek(6, "mon-fri")).toBe(false);
    expect(isWorkingDayOfWeek(6, "mon-sat")).toBe(true);
    expect(isWorkingDayOfWeek(0, "mon-sat")).toBe(false);
    expect(isWorkingDayOfWeek(0, "seven-days")).toBe(true);
  });
});

describe("countWorkingDays", () => {
  // 2026-10-19 is a Monday.
  it("counts Mon-Fri only across a weekend", () => {
    expect(countWorkingDays("2026-10-19", "2026-10-25", "mon-fri")).toBe(5);
    expect(countWorkingDays("2026-10-19", "2026-10-25", "mon-sat")).toBe(6);
    expect(countWorkingDays("2026-10-19", "2026-10-25", "seven-days")).toBe(7);
  });

  it("counts a single working day and a single weekend day", () => {
    expect(countWorkingDays("2026-10-19", "2026-10-19", "mon-fri")).toBe(1);
    expect(countWorkingDays("2026-10-24", "2026-10-24", "mon-fri")).toBe(0);
  });

  it("caps absurd spans even without a clip", () => {
    expect(countWorkingDays("2000-01-01", "2999-12-31", "seven-days")).toBeLessThanOrEqual(5 * 366 + 1);
  });

  it("clips to the window and returns 0 for inverted or malformed ranges", () => {
    expect(countWorkingDays("2026-10-19", "2026-10-30", "mon-fri", { from: "2026-10-21", to: "2026-10-22" })).toBe(2);
    expect(countWorkingDays("2026-10-30", "2026-10-19", "mon-fri")).toBe(0);
    expect(countWorkingDays("nope", "2026-10-19", "mon-fri")).toBe(0);
  });
});

describe("holidayWorkingDaysInYear", () => {
  it("counts approved Annual leave only, clipped to the year", () => {
    const leaves = [
      { type: "Annual", status: "Approved", from: "2025-12-29", to: "2026-01-02" }, // Mon-Fri; 2026 part = Thu+Fri
      { type: "Annual", status: "Approved", from: "2026-10-19", to: "2026-10-23" }, // 5
      { type: "Annual", status: "Pending", from: "2026-11-02", to: "2026-11-06" },
      { type: "Sick", status: "Approved", from: "2026-03-02", to: "2026-03-06" },
    ];
    expect(holidayWorkingDaysInYear(leaves, 2026, "mon-fri")).toBe(7);
  });
});

describe("currentLondonYear", () => {
  it("rolls over at London midnight, not UTC", () => {
    expect(currentLondonYear(new Date("2026-12-31T23:30:00Z"))).toBe(2026);
    expect(currentLondonYear(new Date("2027-01-01T00:00:00Z"))).toBe(2027);
  });
});
