import { describe, expect, it } from "vitest";
import { countDone, footerStatus } from "./form-progress";

describe("countDone", () => {
  it("counts only required sections", () => {
    expect(countDone([{ done: true }, { done: false }, { done: true, optional: true }, { done: false, optional: true }])).toEqual({ done: 1, total: 2 });
  });
  it("handles empty", () => {
    expect(countDone([])).toEqual({ done: 0, total: 0 });
  });
});

describe("footerStatus", () => {
  it("shows progress when there are no errors", () => {
    expect(footerStatus(3, 6, 0)).toBe("3 of 6 sections complete");
  });
  it("prefers errors, with singular/plural", () => {
    expect(footerStatus(3, 6, 1)).toBe("1 field needs attention");
    expect(footerStatus(3, 6, 4)).toBe("4 fields need attention");
  });
});
