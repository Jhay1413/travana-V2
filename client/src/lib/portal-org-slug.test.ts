import { describe, it, expect } from "vitest";
import { normalizeOrgSlug } from "./portal-org-slug";

describe("normalizeOrgSlug", () => {
  it("accepts and normalises a real slug", () => {
    expect(normalizeOrgSlug(" Tinas-Travel ")).toBe("tinas-travel");
    expect(normalizeOrgSlug("agency2")).toBe("agency2");
  });

  it.each([null, undefined, "", "   ", "a b", "-lead", "../etc", "ünï", "a".repeat(101), "x/y"])("rejects %j", (v) => {
    expect(normalizeOrgSlug(v)).toBeNull();
  });
});
