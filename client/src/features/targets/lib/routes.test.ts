import { describe, expect, it } from "vitest";
import { isAllocatePath, parseYear, tabFromPath, tabPath, TAB_ORDER, wizardPath, yearOptions } from "./routes";

describe("tabFromPath", () => {
  it("maps each sub-path to its tab", () => {
    expect(tabFromPath("/agency/targets")).toBe("business");
    expect(tabFromPath("/agency/targets/")).toBe("business");
    expect(tabFromPath("/agency/targets/shops")).toBe("shops");
    expect(tabFromPath("/agency/targets/agents")).toBe("agents");
    expect(tabFromPath("/agency/targets/homeworkers")).toBe("homeworkers");
  });

  it("falls back to Business for anything else", () => {
    expect(tabFromPath("/agency/targets/nope")).toBe("business");
  });

  it("recognises the wizard path", () => {
    expect(isAllocatePath("/agency/targets/allocate")).toBe(true);
    expect(isAllocatePath("/agency/targets/allocate/")).toBe(true);
    expect(isAllocatePath("/agency/targets/shops")).toBe(false);
  });
});

describe("paths", () => {
  it("keeps the year off the address for this year", () => {
    expect(tabPath("shops", 2026, 2026)).toBe("/agency/targets/shops");
    expect(tabPath("business", 2025, 2026)).toBe("/agency/targets?year=2025");
  });

  it("builds wizard addresses", () => {
    expect(wizardPath({ year: 2026, currentYear: 2026 })).toBe("/agency/targets/allocate");
    expect(wizardPath({ step: 1, year: 2026, currentYear: 2026 })).toBe("/agency/targets/allocate");
    expect(wizardPath({ step: 3, branchId: "b1", year: 2026, currentYear: 2026 })).toBe("/agency/targets/allocate?step=3&shop=b1");
    expect(wizardPath({ step: 2, year: 2027, currentYear: 2026 })).toBe("/agency/targets/allocate?step=2&year=2027");
  });
});

describe("parseYear", () => {
  it("reads a sensible year and ignores the rest", () => {
    expect(parseYear("?year=2025", 2026)).toBe(2025);
    expect(parseYear("", 2026)).toBe(2026);
    expect(parseYear("?year=abc", 2026)).toBe(2026);
    expect(parseYear("?year=99999", 2026)).toBe(2026);
  });

  it("offers last year, this year and next", () => {
    expect(yearOptions(2026)).toEqual([2025, 2026, 2027]);
  });
});

describe("tab order", () => {
  it("lists Business, Shops, Agents, Homeworkers", () => {
    expect(TAB_ORDER).toEqual(["business", "shops", "agents", "homeworkers"]);
  });
});
