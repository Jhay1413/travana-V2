import { describe, expect, it } from "vitest";
import { computeActiveSection } from "./active-section";

const secs = [
  { id: "a", top: -500 },
  { id: "b", top: 40 },
  { id: "c", top: 300 },
  { id: "d", top: 600 },
];

describe("computeActiveSection", () => {
  it("picks the last section whose top passed the threshold", () => {
    expect(computeActiveSection(secs, false, null)).toBe("b");
  });
  it("falls back to the first section", () => {
    expect(computeActiveSection([{ id: "a", top: 200 }, { id: "b", top: 400 }], false, null)).toBe("a");
  });
  it("picks the last section when scrolled to the bottom", () => {
    expect(computeActiveSection(secs, true, null)).toBe("d");
  });
  it("keeps the clicked section even when it cannot reach the top (bottom reached)", () => {
    expect(computeActiveSection(secs, true, "c")).toBe("c");
  });
  it("ignores a locked key that is not a section", () => {
    expect(computeActiveSection(secs, false, "zzz")).toBe("b");
  });
  it("handles no sections", () => {
    expect(computeActiveSection([], true, null)).toBe("");
  });
});
