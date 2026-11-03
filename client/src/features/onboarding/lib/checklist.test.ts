import { describe, expect, it } from "vitest";
import {
  CHECKLIST_ITEMS,
  checklistProgress,
  checklistRows,
  dismissKey,
  loadDismissed,
  saveDismissed,
  shouldShowChecklist,
} from "./checklist";
import type { OnboardingChecklist } from "../types";

const none: OnboardingChecklist = { account: true, business: false, invites: false, targets: false, enquiry: false };
const all: OnboardingChecklist = { account: true, business: true, invites: true, targets: true, enquiry: true };

describe("checklist mapping", () => {
  it("links to real V2 pages", () => {
    const href = Object.fromEntries(CHECKLIST_ITEMS.map((i) => [i.key, i.href]));
    expect(href).toMatchObject({
      invites: "/agency/team",
      targets: "/agency/targets",
      enquiry: "/pipeline",
      business: "/agency/profile",
    });
    expect(href.account).toBeUndefined();
  });
  it("counts progress and marks rows", () => {
    expect(checklistProgress(none)).toEqual({ done: 1, total: 5, percent: 20 });
    expect(checklistRows(none).filter((r) => r.isDone).map((r) => r.key)).toEqual(["account"]);
  });
});

describe("shouldShowChecklist", () => {
  it("shows while pending or incomplete, never when dismissed", () => {
    expect(shouldShowChecklist("pending", all, false)).toBe(true);
    expect(shouldShowChecklist("complete", none, false)).toBe(true);
    expect(shouldShowChecklist("complete", all, false)).toBe(false);
    expect(shouldShowChecklist("pending", none, true)).toBe(false);
  });
});

describe("dismissal storage", () => {
  const make = () => {
    const data = new Map<string, string>();
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    };
  };
  it("is stored per user", () => {
    const s = make();
    saveDismissed(s, "u1", true);
    expect(loadDismissed(s, "u1")).toBe(true);
    expect(loadDismissed(s, "u2")).toBe(false);
    expect(dismissKey("u1")).not.toBe(dismissKey("u2"));
    saveDismissed(s, "u1", false);
    expect(loadDismissed(s, "u1")).toBe(false);
  });
  it("survives broken storage", () => {
    const fail = () => {
      throw new Error("blocked");
    };
    const broken = { getItem: fail, setItem: fail, removeItem: fail };
    expect(loadDismissed(broken, "u")).toBe(false);
    expect(() => saveDismissed(broken, "u", true)).not.toThrow();
    expect(loadDismissed(null, "u")).toBe(false);
  });
});
