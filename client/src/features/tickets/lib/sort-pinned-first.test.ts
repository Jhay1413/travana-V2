import { describe, expect, it } from "vitest";
import { sortPinnedFirst } from "./sort-pinned-first";

interface Item {
  id: string;
  label: string;
}

const items: Item[] = [
  { id: "a", label: "A" },
  { id: "b", label: "B" },
  { id: "c", label: "C" },
  { id: "d", label: "D" },
];

describe("sortPinnedFirst", () => {
  it("moves pinned items to the front and keeps the rest in their existing order", () => {
    const pinnedAt = new Map([
      ["c", 100],
      ["a", 100],
    ]);
    // Equal pin times fall back to the caller's order (a before c).
    expect(sortPinnedFirst(items, pinnedAt).map((i) => i.id)).toEqual(["a", "c", "b", "d"]);
  });

  it("puts the most recently pinned item at the very top", () => {
    const pinnedAt = new Map([
      ["a", 100],
      ["d", 300],
      ["b", 200],
    ]);
    expect(sortPinnedFirst(items, pinnedAt).map((i) => i.id)).toEqual(["d", "b", "a", "c"]);
  });

  it("returns the items unchanged (in order) when nothing is pinned", () => {
    expect(sortPinnedFirst(items, new Map())).toEqual(items);
  });

  it("does not mutate the input array", () => {
    const copy = [...items];
    sortPinnedFirst(items, new Map([["d", 1]]));
    expect(items).toEqual(copy);
  });
});
