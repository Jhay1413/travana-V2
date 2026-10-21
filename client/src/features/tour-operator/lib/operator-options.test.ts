import { describe, expect, it } from "vitest";
import type { TourOperator } from "../types";
import { findOperator, operatorSelectOptions } from "./operator-options";

const op = (id: string, name: string, is_active = true): TourOperator => ({
  id,
  linkId: `l-${id}`,
  name,
  logo_url: null,
  code: null,
  commission_percentage: "10.00",
  balance_due_weeks: 14,
  is_active,
});

const list = [op("a", "Jet2"), op("b", "TUI", false)];

describe("operatorSelectOptions", () => {
  it("returns only active operators when nothing is selected", () => {
    expect(operatorSelectOptions(list)).toEqual([{ value: "a", label: "Jet2" }]);
  });
  it("keeps a selected inactive operator", () => {
    expect(operatorSelectOptions(list, "b").map((o) => o.value)).toEqual(["a", "b"]);
  });
  it("adds a synthetic entry for an unlinked selection", () => {
    expect(operatorSelectOptions(list, "z")).toContainEqual({ value: "z", label: "Unlisted operator" });
    expect(operatorSelectOptions(list, "z", "Old Co")).toContainEqual({ value: "z", label: "Old Co" });
  });
  it("never reports Unlisted while the list has not loaded", () => {
    expect(operatorSelectOptions(undefined, "z")).toEqual([]);
    expect(operatorSelectOptions(undefined, "z", "Old Co")).toEqual([{ value: "z", label: "Old Co" }]);
  });
});

describe("findOperator", () => {
  it("finds by catalogue id", () => {
    expect(findOperator(list, "b")?.name).toBe("TUI");
    expect(findOperator(list, "x")).toBeUndefined();
    expect(findOperator(undefined, "a")).toBeUndefined();
  });
});
