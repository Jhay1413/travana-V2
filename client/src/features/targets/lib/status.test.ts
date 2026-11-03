import { describe, expect, it } from "vitest";
import { barPercent, elapsedPercent, paceStatus, percentOf } from "./status";

describe("paceStatus", () => {
  // Pace = (profit / target) / elapsed. Half way through the year, a 100,000 target.
  it("is Ahead at 100% of pace or more", () => {
    expect(paceStatus(50000, 100000, 0.5)).toBe("ahead");
    expect(paceStatus(80000, 100000, 0.5)).toBe("ahead");
  });

  it("is On track from 90% up to just under 100%", () => {
    expect(paceStatus(45000, 100000, 0.5)).toBe("on_track");
    expect(paceStatus(49999, 100000, 0.5)).toBe("on_track");
  });

  it("is Behind under 90%", () => {
    expect(paceStatus(44999, 100000, 0.5)).toBe("behind");
    expect(paceStatus(0, 100000, 0.5)).toBe("behind");
  });

  it("treats a zero target as On track", () => {
    expect(paceStatus(0, 0, 0.5)).toBe("on_track");
    expect(paceStatus(1000, 0, 0.5)).toBe("on_track");
  });

  it("treats a year that has not started as On track", () => {
    expect(paceStatus(0, 100000, 0)).toBe("on_track");
  });
});

describe("bar maths", () => {
  it("caps the fill at 100 and never goes negative", () => {
    expect(barPercent(150, 100)).toBe(100);
    expect(barPercent(-5, 100)).toBe(0);
    expect(barPercent(5, 0)).toBe(0);
    expect(barPercent(25, 100)).toBe(25);
  });

  it("places the elapsed marker inside the bar", () => {
    expect(elapsedPercent(0.794)).toBeCloseTo(79.4);
    expect(elapsedPercent(2)).toBe(100);
    expect(elapsedPercent(-1)).toBe(0);
  });

  it("rounds percentages and guards against dividing by zero", () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(5, 0)).toBe(0);
  });
});
