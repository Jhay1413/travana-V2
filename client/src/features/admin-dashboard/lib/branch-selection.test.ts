import { describe, expect, it } from "vitest";
import { ALL_BRANCHES, branchIdParam, resolveSelectedBranch } from "./branch-selection";

const base = { stored: "b2", branchesLoaded: true, showSelect: true, branchIds: ["b1", "b2"] };

describe("branch-selection", () => {
  it("trusts a stored branch that exists", () => {
    expect(resolveSelectedBranch(base)).toBe("b2");
  });

  it("ignores a stored branch that no longer exists", () => {
    expect(resolveSelectedBranch({ ...base, stored: "gone" })).toBe(ALL_BRANCHES);
  });

  it("ignores the stored branch until the list has loaded", () => {
    expect(resolveSelectedBranch({ ...base, branchesLoaded: false })).toBe(ALL_BRANCHES);
  });

  it("ignores the stored branch when no select is shown", () => {
    expect(resolveSelectedBranch({ ...base, showSelect: false })).toBe(ALL_BRANCHES);
  });

  it("maps the selection to a query param", () => {
    expect(branchIdParam(ALL_BRANCHES)).toBeUndefined();
    expect(branchIdParam("b1")).toBe("b1");
  });
});
