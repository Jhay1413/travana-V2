import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, sanitizePrefs } from "./queue-prefs";

describe("sanitizePrefs", () => {
  it("falls back to defaults for junk", () => {
    expect(sanitizePrefs(null, true)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs("x", true)).toEqual(DEFAULT_PREFS);
    expect(sanitizePrefs({ scope: "nope", view: 3, chip: [], sort: {} }, true)).toEqual(DEFAULT_PREFS);
  });
  it("keeps valid values", () => {
    const raw = { scope: "raised", view: "board", chip: "attention", sort: "client", filters: { priorities: ["High"], kinds: ["Sales"] }, search: "mia" };
    expect(sanitizePrefs(raw, false)).toEqual(raw);
  });
  it("keeps search text but caps its length and ignores non-strings", () => {
    expect(sanitizePrefs({ search: "x".repeat(150) }, true).search).toHaveLength(100);
    expect(sanitizePrefs({ search: 5 }, true).search).toBe("");
  });
  it("drops the all scope without an admin role", () => {
    expect(sanitizePrefs({ scope: "all" }, false).scope).toBe("mine");
    expect(sanitizePrefs({ scope: "all" }, true).scope).toBe("all");
  });
  it("ignores non-string filter entries", () => {
    expect(sanitizePrefs({ filters: { priorities: ["High", 4, null], kinds: "Sales" } }, true).filters).toEqual({ priorities: ["High"], kinds: [] });
  });
});
