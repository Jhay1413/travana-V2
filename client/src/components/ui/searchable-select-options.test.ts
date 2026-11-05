import { describe, expect, it } from "vitest";
import { orderOptions } from "./searchable-select-options";

const opts = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
  { value: "c", label: "C" },
];

describe("orderOptions", () => {
  it("moves the selected option to the top and keeps the rest in order", () => {
    expect(orderOptions(opts, "c", "", true).map((o) => o.value)).toEqual(["c", "a", "b"]);
    expect(orderOptions(opts, "b", "", true).map((o) => o.value)).toEqual(["b", "a", "c"]);
  });
  it("leaves the list alone when the feature is off", () => {
    expect(orderOptions(opts, "c", "", false)).toBe(opts);
  });
  it("leaves the list alone while searching", () => {
    expect(orderOptions(opts, "c", "x", true)).toBe(opts);
  });
  it("leaves the list alone with no selection, an unknown selection or the first already selected", () => {
    expect(orderOptions(opts, "", "", true)).toBe(opts);
    expect(orderOptions(opts, "zzz", "", true)).toBe(opts);
    expect(orderOptions(opts, "a", "", true)).toBe(opts);
  });
  it("does not mutate the input", () => {
    orderOptions(opts, "c", "", true);
    expect(opts.map((o) => o.value)).toEqual(["a", "b", "c"]);
  });
});
