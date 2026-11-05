import { describe, expect, it } from "vitest";
import { autoExtraCommission, extraCommissionPct, nextExtraCommission } from "./extra-commission";

const notIncluded = { cost: 200, isIncludedInPackage: false, extraOperatorPct: 10, mainOperatorPct: 5 };

describe("autoExtraCommission", () => {
  it("uses the extra's own operator %", () => {
    expect(autoExtraCommission(notIncluded)).toBe(20);
  });
  it("falls back to the main operator % when the extra has no operator rate", () => {
    expect(autoExtraCommission({ ...notIncluded, extraOperatorPct: null })).toBe(10);
  });
  it("is 0 when neither operator has a rate", () => {
    expect(autoExtraCommission({ ...notIncluded, extraOperatorPct: null, mainOperatorPct: null })).toBe(0);
  });
  it("is 0 for an extra included in the package, whatever its cost", () => {
    expect(autoExtraCommission({ ...notIncluded, isIncludedInPackage: true })).toBe(0);
    expect(autoExtraCommission({ ...notIncluded, isIncludedInPackage: undefined })).toBe(0);
  });
  it("parses string costs, rounds to pence and ignores a zero or invalid cost", () => {
    expect(autoExtraCommission({ ...notIncluded, cost: "33.33", extraOperatorPct: 12.5 })).toBe(4.17);
    expect(autoExtraCommission({ ...notIncluded, cost: 0 })).toBe(0);
    expect(autoExtraCommission({ ...notIncluded, cost: "abc" })).toBe(0);
  });
  it("treats a 0% own rate as a real rate (no fallback)", () => {
    expect(extraCommissionPct(0, 5)).toBe(0);
    expect(autoExtraCommission({ ...notIncluded, extraOperatorPct: 0 })).toBe(0);
  });
});

describe("nextExtraCommission", () => {
  it("returns the auto value until the agent edits it", () => {
    expect(nextExtraCommission({ ...notIncluded, manual: false })).toBe(20);
  });
  it("returns null (leave the field alone) once the commission was set by hand", () => {
    expect(nextExtraCommission({ ...notIncluded, manual: true })).toBeNull();
  });
});
