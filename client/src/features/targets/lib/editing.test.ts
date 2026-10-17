import { describe, expect, it } from "vitest";
import { monthsGapMessage, parseYearly, resolveEdit } from "./editing";
import { evenMonths, sum } from "./months";

const base = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];

describe("resolveEdit", () => {
  it("rescales untouched months to the new yearly total", () => {
    const r = resolveEdit({ yearly: "20,000", months: [], monthsTouched: false, base });
    expect(r.ok).toBe(true);
    if (r.ok) expect(sum(r.months)).toBe(20000);
  });

  it("requires typed months to add up to the yearly target", () => {
    const months = evenMonths(1200).map(String);
    const bad = resolveEdit({ yearly: "1,300", months, monthsTouched: true, base });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain("Add £100");
    expect(resolveEdit({ yearly: "1,200", months, monthsTouched: true, base }).ok).toBe(true);
  });

  it("reports bad boxes and a bad yearly amount", () => {
    const months = Array(12).fill("100");
    months[4] = "x";
    const r = resolveEdit({ yearly: "1,200", months, monthsTouched: true, base });
    expect(!r.ok && r.monthErrors && Object.keys(r.monthErrors)).toEqual(["4"]);
    expect(resolveEdit({ yearly: "0", months, monthsTouched: false, base }).ok).toBe(false);
  });
});

describe("helpers", () => {
  it("words the gap between months and target", () => {
    expect(monthsGapMessage(1000, 1000)).toBeNull();
    expect(monthsGapMessage(1100, 1000)).toContain("Take off £100");
  });
  it("needs a positive yearly amount", () => {
    expect(parseYearly("0").ok).toBe(false);
    expect(parseYearly("5").ok).toBe(true);
  });
});
