import { describe, expect, it } from "vitest";
import { ONBOARDING_DRAFT_PREFIX, clearAllOnboardingDrafts } from "./onboarding-drafts";

function fakeStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("clearAllOnboardingDrafts", () => {
  it("removes only onboarding drafts", () => {
    const s = fakeStorage({
      [`${ONBOARDING_DRAFT_PREFIX}u1`]: "{}",
      [`${ONBOARDING_DRAFT_PREFIX}u2`]: "{}",
      "travana.menu-mode": "admin",
    });
    clearAllOnboardingDrafts(s);
    expect(Array.from(s.data.keys())).toEqual(["travana.menu-mode"]);
  });
  it("tolerates missing or throwing storage", () => {
    expect(() => clearAllOnboardingDrafts(null)).not.toThrow();
    const bad = {
      length: 1,
      key: () => {
        throw new Error("x");
      },
      removeItem: () => undefined,
    };
    expect(() => clearAllOnboardingDrafts(bad)).not.toThrow();
  });
});
