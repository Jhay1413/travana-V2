import { describe, it, expect } from "vitest";
import { canSaveInterests, selectionText, toggleId } from "./interests";

describe("toggleId", () => {
  it("adds, then removes, without changing the original", () => {
    const empty = new Set<string>();
    const one = toggleId(empty, "a");
    expect([...one]).toEqual(["a"]);
    expect(empty.size).toBe(0);
    expect(toggleId(one, "a").size).toBe(0);
    expect([...toggleId(one, "b")]).toEqual(["a", "b"]);
  });
});

describe("canSaveInterests / selectionText", () => {
  it("needs one interest and no save in flight", () => {
    expect(canSaveInterests(0, false)).toBe(false);
    expect(canSaveInterests(1, true)).toBe(false);
    expect(canSaveInterests(2, false)).toBe(true);
  });

  it("says what to do, or how many are chosen", () => {
    expect(selectionText(0)).toBe("Select at least one interest to continue");
    expect(selectionText(3)).toBe("3 selected");
  });
});
