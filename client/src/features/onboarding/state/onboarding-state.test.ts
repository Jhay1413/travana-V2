import { describe, expect, it } from "vitest";
import { browserStorage, clearDraft, draftKey, loadDraft, saveDraft } from "./onboarding-draft";
import { initialState, mergeServerBusiness, normaliseStep, reducer, startState, toDraft } from "./onboarding-state";
import { isBlankPerson, seedAgents, syncAgents } from "../lib/rows";
import type { OnboardingState } from "../types";

const server = (over: Partial<OnboardingState> = {}): OnboardingState => ({
  status: "pending",
  businessType: null,
  business: { name: "Sun Travel", phone: null, address: null, website: null, email: null },
  owner: { firstName: "Al", lastName: "Tay", email: "al@x.co" },
  branches: [],
  homeworkerCommission: null,
  checklist: { account: true, business: false, invites: false, targets: false, enquiry: false },
  ...over,
});

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

describe("seedAgents", () => {
  it("adds a Branch Manager row only when there is one", () => {
    const rows = seedAgents({ hasBranchManager: true, agentCount: "3" });
    expect(rows).toHaveLength(4);
    expect(rows[0]?.role).toBe("Branch Manager");
    expect(seedAgents({ hasBranchManager: false, agentCount: "2" }).every((r) => r.role === "Agent")).toBe(true);
  });
  it("reseeds only untouched tables", () => {
    const rows = seedAgents({ hasBranchManager: false, agentCount: "2" });
    expect(syncAgents(rows, { hasBranchManager: true, agentCount: "4" })).toHaveLength(5);
    const typed = rows.map((r, i) => (i === 0 ? { ...r, email: "x@y.co" } : r));
    expect(syncAgents(typed, { hasBranchManager: true, agentCount: "4" })).toBe(typed);
    expect(rows.every(isBlankPerson)).toBe(true);
  });
});

describe("startState / mergeServerBusiness", () => {
  it("prefills business name and email from the server", () => {
    const s = startState(null, server());
    expect(s.business.businessName).toBe("Sun Travel");
    expect(s.business.email).toBe("al@x.co");
    expect(s.step).toBe("business");
  });
  it("lets saved server values win over the draft, blanks keep the draft", () => {
    const base = { ...initialState().business, phone: "123", address: "typed" };
    const merged = mergeServerBusiness(
      base,
      server({ businessType: "multi", business: { name: "S", phone: "999", address: null, website: null, email: null } }),
    );
    expect(merged.phone).toBe("999");
    expect(merged.address).toBe("typed");
    expect(merged.businessType).toBe("multi");
  });
  it("seeds the commission from the server when the draft has none", () => {
    expect(startState(null, server({ homeworkerCommission: 40 })).commission).toBe("40");
  });
});

describe("normaliseStep", () => {
  it("fixes steps that do not fit the business type and review screens", () => {
    expect(normaliseStep("team", "single")).toBe("agents");
    expect(normaliseStep("agents", "multi")).toBe("shops");
    expect(normaliseStep("shops-review", "multi")).toBe("shops");
    expect(normaliseStep("done", "single")).toBe("done");
  });
});

describe("reducer", () => {
  it("patches state", () => {
    expect(reducer(initialState(), { type: "patch", patch: { step: "done" } }).step).toBe("done");
  });
});

describe("draft storage", () => {
  it("round-trips per user and never stores the review", () => {
    const s = memoryStorage();
    const state = { ...initialState(), step: "agents" as const, commission: "50" };
    saveDraft(s, "u1", toDraft(state));
    expect(loadDraft(s, "u1")?.commission).toBe("50");
    expect(loadDraft(s, "u2")).toBeNull();
    expect(s.data.get(draftKey("u1"))).not.toContain("review");
    clearDraft(s, "u1");
    expect(loadDraft(s, "u1")).toBeNull();
  });
  it("ignores bad JSON, bad shape and throwing storage", () => {
    const s = memoryStorage();
    s.data.set(draftKey("u"), "{not json");
    expect(loadDraft(s, "u")).toBeNull();
    s.data.set(draftKey("u"), JSON.stringify({ version: 2 }));
    expect(loadDraft(s, "u")).toBeNull();
    const fail = () => {
      throw new Error("x");
    };
    const broken = { getItem: fail, setItem: fail, removeItem: fail };
    expect(loadDraft(broken, "u")).toBeNull();
    expect(() => saveDraft(broken, "u", toDraft(initialState()))).not.toThrow();
    expect(loadDraft(null, "u")).toBeNull();
    expect(browserStorage()).toBeNull();
  });
});
