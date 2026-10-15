import { describe, it, expect } from "vitest";
import { branchTypeOf, defaultTargetBranch, hasNoTargetBranches, hidesShopTargets } from "./targets-helpers";

const b = (id: string, isActive = true, isDefault = false) => ({ id, isActive, isDefault });

describe("targets helpers", () => {
  it("hides the shop editor only for homeworker branches", () => {
    expect(hidesShopTargets("homeworker")).toBe(true);
    expect(hidesShopTargets("shop")).toBe(false);
  });
  it("resolves the branch type from the lists", () => {
    expect(branchTypeOf("h1", [b("s1")], [b("h1")])).toBe("homeworker");
    expect(branchTypeOf("s1", [b("s1")], [b("h1")])).toBe("shop");
    expect(branchTypeOf(null, [], [])).toBe("shop");
  });
  it("defaults to the default shop branch, then first shop, then first homeworker", () => {
    expect(defaultTargetBranch([b("s1"), b("s2", true, true)], [b("h1")])).toBe("s2");
    expect(defaultTargetBranch([b("s1")], [b("h1")])).toBe("s1");
    expect(defaultTargetBranch([], [b("h1")])).toBe("h1");
    expect(defaultTargetBranch([b("s1", false)], [])).toBeNull();
  });
  it("empty state needs both lists empty", () => {
    expect(hasNoTargetBranches([], [])).toBe(true);
    expect(hasNoTargetBranches([], [b("h1")])).toBe(false);
    expect(hasNoTargetBranches([b("s1")], [])).toBe(false);
    expect(hasNoTargetBranches([b("s1", false)], [b("h1", false)])).toBe(true);
  });
});
