import { describe, expect, it } from "vitest";
import { TARGETS_DRAFT_PREFIX, clearAllTargetsDrafts } from "./targets-drafts";

describe("clearAllTargetsDrafts", () => {
  it("removes only targets drafts", () => {
    const data: Record<string, string> = { [`${TARGETS_DRAFT_PREFIX}o.u.2026`]: "x", [`${TARGETS_DRAFT_PREFIX}o.u.2027`]: "y", other: "z" };
    const storage = {
      get length() {
        return Object.keys(data).length;
      },
      key: (i: number) => Object.keys(data)[i] ?? null,
      removeItem: (k: string) => {
        delete data[k];
      },
    };
    clearAllTargetsDrafts(storage);
    expect(Object.keys(data)).toEqual(["other"]);
  });
  it("tolerates no storage", () => {
    expect(() => clearAllTargetsDrafts(null)).not.toThrow();
  });
});
