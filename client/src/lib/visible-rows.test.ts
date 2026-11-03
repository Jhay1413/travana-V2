import { describe, expect, it } from "vitest";
import { visibleRows } from "./visible-rows";

const rows = [1, 2, 3, 4, 5, 6, 7, 8];

describe("visibleRows", () => {
  it("caps at max when collapsed", () => {
    expect(visibleRows(rows, false, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("returns every row when expanded", () => {
    expect(visibleRows(rows, true, 6)).toEqual(rows);
  });
  it("returns all rows when fewer than max", () => {
    expect(visibleRows([1, 2], false, 6)).toEqual([1, 2]);
  });
  it("handles empty input", () => {
    expect(visibleRows([], true, 6)).toEqual([]);
  });
});
