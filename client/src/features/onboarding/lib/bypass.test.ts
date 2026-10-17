import { describe, expect, it } from "vitest";
import { hasOnboardingBypass, isOnboardingLeaving, setOnboardingBypass, setOnboardingLeaving } from "./bypass";

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("onboarding bypass", () => {
  it("is per user", () => {
    const s = memory();
    setOnboardingBypass(s, "u1");
    expect(hasOnboardingBypass(s, "u1")).toBe(true);
    expect(hasOnboardingBypass(s, "u2")).toBe(false);
  });
  it("ignores a missing user and a throwing storage", () => {
    const s = memory();
    setOnboardingBypass(s, "");
    expect(hasOnboardingBypass(s, "")).toBe(false);
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(() => setOnboardingBypass(broken, "u")).not.toThrow();
    expect(hasOnboardingBypass(broken, "u")).toBe(false);
  });
  it("tracks the leaving flag", () => {
    setOnboardingLeaving(true);
    expect(isOnboardingLeaving()).toBe(true);
    setOnboardingLeaving(false);
    expect(isOnboardingLeaving()).toBe(false);
  });
});
