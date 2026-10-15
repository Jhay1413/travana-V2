import { describe, it, expect } from "vitest";
import { upsertShopTargetsValidator, upsertAgentTargetsValidator, branchQueryValidator } from "./targets.validator";

const shopItem = { year: 2026, month: 3, targetAmount: "100.00" };
const agentItem = { ...shopItem, userId: "u1" };

describe("upsertShopTargetsValidator", () => {
  it("accepts a valid body with optional branchId", () => {
    expect(upsertShopTargetsValidator.safeParse({ query: {}, body: { targets: [shopItem], branchId: "b1" } }).success).toBe(true);
  });
  it("rejects a missing, non-array or empty targets list", () => {
    for (const targets of [undefined, "x", []]) {
      expect(upsertShopTargetsValidator.safeParse({ query: {}, body: { targets } }).success).toBe(false);
    }
  });
  it("rejects non-numeric month and non-string amount", () => {
    expect(upsertShopTargetsValidator.safeParse({ query: {}, body: { targets: [{ ...shopItem, month: "3" }] } }).success).toBe(false);
    expect(upsertShopTargetsValidator.safeParse({ query: {}, body: { targets: [{ ...shopItem, targetAmount: 5 }] } }).success).toBe(false);
  });
});

describe("upsertAgentTargetsValidator", () => {
  it("accepts a valid body", () => {
    expect(upsertAgentTargetsValidator.safeParse({ query: {}, body: { targets: [agentItem] } }).success).toBe(true);
  });
  it("requires userId on every item", () => {
    const r = upsertAgentTargetsValidator.safeParse({ query: {}, body: { targets: [shopItem] } });
    expect(r.success).toBe(false);
  });
  it("rejects an empty list", () => {
    expect(upsertAgentTargetsValidator.safeParse({ query: {}, body: { targets: [] } }).success).toBe(false);
  });
});

describe("branchQueryValidator", () => {
  it("accepts no branchId or a non-empty one, rejects empty", () => {
    expect(branchQueryValidator.safeParse({ query: {} }).success).toBe(true);
    expect(branchQueryValidator.safeParse({ query: { branchId: "b1" } }).success).toBe(true);
    expect(branchQueryValidator.safeParse({ query: { branchId: "" } }).success).toBe(false);
  });
});
