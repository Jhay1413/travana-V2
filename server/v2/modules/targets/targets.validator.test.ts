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

import {
  yearQueryValidator,
  monthsBodyValidator,
  overrideBodyValidator,
  revertOverrideValidator,
  allocationValidator,
} from "./targets.validator";

const twelve = (v = 1000) => new Array<number>(12).fill(v);
const UUID = "6f1c1c0e-2f55-4a40-9d4e-0c5a3f2f9b11";

describe("yearQueryValidator", () => {
  it("coerces a numeric string and bounds the year", () => {
    expect(yearQueryValidator.safeParse({ query: { year: "2026" } }).success).toBe(true);
    expect(yearQueryValidator.safeParse({ query: { year: "1999" } }).success).toBe(false);
    expect(yearQueryValidator.safeParse({ query: { year: "2101" } }).success).toBe(false);
    expect(yearQueryValidator.safeParse({ query: {} }).success).toBe(false);
  });
});

describe("monthsBodyValidator", () => {
  const parse = (body: unknown) => monthsBodyValidator.safeParse({ body });
  it("accepts 12 whole non-negative pounds", () => {
    expect(parse({ year: 2026, months: twelve() }).success).toBe(true);
    expect(parse({ year: 2026, months: twelve(50_000_000) }).success).toBe(true);
  });
  it("rejects wrong length, fractions, negatives, over-cap and bad years", () => {
    expect(parse({ year: 2026, months: [1, 2] }).success).toBe(false);
    expect(parse({ year: 2026, months: [...twelve().slice(1), 10.5] }).success).toBe(false);
    expect(parse({ year: 2026, months: [...twelve().slice(1), -1] }).success).toBe(false);
    expect(parse({ year: 2026, months: [...twelve().slice(1), 50_000_001] }).success).toBe(false);
    expect(parse({ year: 1999, months: twelve() }).success).toBe(false);
    expect(parse({ year: 2101, months: twelve() }).success).toBe(false);
    expect(parse({ year: 2026, months: twelve().map(String) }).success).toBe(false);
  });
});

describe("override validators", () => {
  it("accepts an optional or null note and requires the userId param", () => {
    const ok = (note?: string | null) =>
      overrideBodyValidator.safeParse({ params: { userId: "u1" }, body: { year: 2026, months: twelve(), note } }).success;
    expect(ok()).toBe(true);
    expect(ok(null)).toBe(true);
    expect(ok("Agreed with Sam")).toBe(true);
    expect(overrideBodyValidator.safeParse({ params: {}, body: { year: 2026, months: twelve() } }).success).toBe(false);
  });
  it("revert needs a year query", () => {
    expect(revertOverrideValidator.safeParse({ params: { userId: "u1" }, query: { year: "2026" } }).success).toBe(true);
    expect(revertOverrideValidator.safeParse({ params: { userId: "u1" }, query: {} }).success).toBe(false);
  });
});

describe("allocationValidator", () => {
  const parse = (body: unknown) => allocationValidator.safeParse({ body });
  it("accepts any non-empty combination of business, shops and agents", () => {
    expect(parse({ year: 2026, business: { months: twelve() } }).success).toBe(true);
    expect(parse({ year: 2026, shops: [{ branchId: UUID, months: twelve() }] }).success).toBe(true);
    expect(parse({ year: 2026, agents: [{ branchId: UUID, userId: "u1", months: twelve() }] }).success).toBe(true);
  });
  it("rejects an empty payload and malformed rows", () => {
    expect(parse({ year: 2026 }).success).toBe(false);
    expect(parse({ year: 2026, shops: [] }).success).toBe(false);
    expect(parse({ year: 2026, shops: [{ branchId: "nope", months: twelve() }] }).success).toBe(false);
    expect(parse({ year: 2026, agents: [{ branchId: UUID, userId: "", months: twelve() }] }).success).toBe(false);
    expect(parse({ year: 2026, agents: [{ branchId: UUID, userId: "u1", months: [1] }] }).success).toBe(false);
  });
});
