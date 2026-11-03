import { describe, expect, it } from "vitest";
import { emptyCopy } from "./empty-copy";

describe("emptyCopy", () => {
  it("prefers the no-match copy when searching or filtering", () => {
    const copy = "Nothing matches. Try clearing the search or filters.";
    expect(emptyCopy({ tab: "open", hasSearch: true, hasFilters: false })).toBe(copy);
    expect(emptyCopy({ tab: "done", hasSearch: false, hasFilters: true })).toBe(copy);
  });

  it("uses tab-specific copy otherwise", () => {
    expect(emptyCopy({ tab: "open", hasSearch: false, hasFilters: false })).toBe("Everything is answered. Nice work.");
    expect(emptyCopy({ tab: "snoozed", hasSearch: false, hasFilters: false })).toBe("Nothing is snoozed.");
    expect(emptyCopy({ tab: "done", hasSearch: false, hasFilters: false })).toBe("Nothing has been marked done yet.");
  });
});
