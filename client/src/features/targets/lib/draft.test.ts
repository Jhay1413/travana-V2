import { describe, expect, it } from "vitest";
import { clearDraft, draftKey, loadDraft, saveDraft, type StorageLike } from "./draft";
import type { Plan } from "../types";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

const plan: Plan = { business: "100,000", shops: { hetton: "60,000" }, agents: { sarah: "40,000" } };

describe("draftKey", () => {
  it("is separate per organisation, person and year", () => {
    const keys = new Set([draftKey("o1", "u1", 2026), draftKey("o2", "u1", 2026), draftKey("o1", "u2", 2026), draftKey("o1", "u1", 2027)]);
    expect(keys.size).toBe(4);
  });
});

describe("draft storage", () => {
  const key = draftKey("o1", "u1", 2026);

  it("saves and loads a draft", () => {
    const s = memoryStorage();
    expect(saveDraft(s, key, { plan, snapshot: plan, step: 3 }, new Date("2026-10-16T09:00:00Z"))).toBe(true);
    expect(loadDraft(s, key)).toEqual({ version: 2, step: 3, plan, snapshot: plan, savedAt: "2026-10-16T09:00:00.000Z" });
  });

  it("does not leak between people or years", () => {
    const s = memoryStorage();
    saveDraft(s, key, { plan, snapshot: plan, step: 2 });
    expect(loadDraft(s, draftKey("o1", "u2", 2026))).toBeNull();
    expect(loadDraft(s, draftKey("o1", "u1", 2027))).toBeNull();
  });

  it("clears a draft", () => {
    const s = memoryStorage();
    saveDraft(s, key, { plan, snapshot: plan, step: 2 });
    clearDraft(s, key);
    expect(loadDraft(s, key)).toBeNull();
  });

  it("ignores corrupt or wrongly-shaped data", () => {
    expect(loadDraft(memoryStorage({ [key]: "{nope" }), key)).toBeNull();
    expect(loadDraft(memoryStorage({ [key]: JSON.stringify({ version: 1, step: 1 }) }), key)).toBeNull();
    expect(loadDraft(memoryStorage({ [key]: JSON.stringify({ version: 2, step: 1, savedAt: "x", plan: { business: 5, shops: {}, agents: {} }, snapshot: plan }) }), key)).toBeNull();
  });

  it("survives missing or throwing storage", () => {
    expect(loadDraft(null, key)).toBeNull();
    expect(saveDraft(null, key, { plan, snapshot: plan, step: 1 })).toBe(false);
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadDraft(broken, key)).toBeNull();
    expect(saveDraft(broken, key, { plan, snapshot: plan, step: 1 })).toBe(false);
    expect(() => clearDraft(broken, key)).not.toThrow();
  });
});
