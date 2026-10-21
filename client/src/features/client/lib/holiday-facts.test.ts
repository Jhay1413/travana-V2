import { describe, expect, it } from "vitest";
import type { FieldRowSpec } from "@/features/client/components/holiday-fields";
import { factRows } from "./holiday-facts";

const f = (key: string, value: string | null): FieldRowSpec => ({ key, icon: "tag", label: key, value });

describe("factRows", () => {
  it("interleaves left and right", () => {
    const rows = factRows({ left: [f("l1", "a"), f("l2", "b")], right: [f("r1", "c"), f("r2", "d")] });
    expect(rows.map((r) => r.key)).toEqual(["l1", "r1", "l2", "r2"]);
  });
  it("drops rows without a value", () => {
    const rows = factRows({ left: [f("l1", null), f("l2", "b")], right: [f("r1", "")] });
    expect(rows.map((r) => r.key)).toEqual(["l2"]);
  });
  it("keeps the tail of the longer list", () => {
    const rows = factRows({ left: [f("l1", "a")], right: [f("r1", "b"), f("r2", "c"), f("r3", "d")] });
    expect(rows.map((r) => r.key)).toEqual(["l1", "r1", "r2", "r3"]);
  });
  it("returns an empty list when nothing has a value", () => {
    expect(factRows({ left: [f("l1", null)], right: [] })).toEqual([]);
  });
});
