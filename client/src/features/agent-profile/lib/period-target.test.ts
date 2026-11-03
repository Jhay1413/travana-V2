import { describe, expect, it } from "vitest";
import { periodTarget } from "./period-target";

const flat = (n: number): number[] => Array.from({ length: 12 }, () => n);

describe("periodTarget", () => {
  it("gives a whole month exactly its month target", () => {
    expect(periodTarget("2026-10-01", "2026-11-01", { 2026: flat(3100) })).toBe(3100);
  });

  it("takes a share of the month for part of it", () => {
    // 7 days of October (31 days) at 3,100.
    expect(periodTarget("2026-10-19", "2026-10-26", { 2026: flat(3100) })).toBe(700);
    expect(periodTarget("2026-10-19", "2026-10-20", { 2026: flat(3100) })).toBe(100);
  });

  it("adds two months when the window straddles them", () => {
    const targets = flat(0);
    targets[9] = 3100; // October
    targets[10] = 3000; // November
    // 6 days of October + 2 days of November.
    expect(periodTarget("2026-10-26", "2026-11-03", { 2026: targets })).toBe(600 + 200);
  });

  it("adds two years across New Year", () => {
    const dec = flat(0);
    dec[11] = 3100;
    const jan = flat(0);
    jan[0] = 3100;
    expect(periodTarget("2026-12-29", "2027-01-03", { 2026: dec, 2027: jan })).toBe(300 + 200);
  });

  it("uses the real length of a leap February", () => {
    const t = flat(0);
    t[1] = 2900;
    expect(periodTarget("2028-02-01", "2028-03-01", { 2028: t })).toBe(2900);
    expect(periodTarget("2028-02-01", "2028-02-02", { 2028: t })).toBe(100);
  });

  it("is zero when no target is set or the year has not loaded", () => {
    expect(periodTarget("2026-10-01", "2026-11-01", { 2026: flat(0) })).toBe(0);
    expect(periodTarget("2026-10-01", "2026-11-01", {})).toBe(0);
    expect(periodTarget("2026-10-01", "2026-11-01", { 2026: undefined })).toBe(0);
  });
});
