import { describe, it, expect } from "vitest";
import { getCompareValidator, getProfitSourcesValidator } from "./organization-overview.validator";

const parse = (query: unknown) => getCompareValidator.safeParse({ query });
const UUID = "5b9d7c1e-6f0a-4c3e-8d2b-1a2b3c4d5e6f";

describe("getCompareValidator", () => {
  it.each([
    ["week", "prev"],
    ["week", "year"],
    ["month", "prev"],
    ["month", "year"],
    ["year", "prev"],
    ["year", "year"],
    ["year", "two_years"],
  ])("accepts %s/%s", (period, against) => {
    expect(parse({ period, against }).success).toBe(true);
  });

  it.each([
    ["week", "two_years"],
    ["month", "two_years"],
  ])("rejects %s/%s", (period, against) => {
    expect(parse({ period, against }).success).toBe(false);
  });

  it("rejects unknown or missing values", () => {
    expect(parse({ period: "day", against: "prev" }).success).toBe(false);
    expect(parse({ period: "week" }).success).toBe(false);
    expect(parse({ against: "prev" }).success).toBe(false);
  });

  it("validates branchId as a uuid", () => {
    expect(parse({ period: "week", against: "prev", branchId: UUID }).success).toBe(true);
    expect(parse({ period: "week", against: "prev", branchId: "nope" }).success).toBe(false);
  });
});

describe("getProfitSourcesValidator", () => {
  it("accepts an optional uuid branchId", () => {
    expect(getProfitSourcesValidator.safeParse({ query: {} }).success).toBe(true);
    expect(getProfitSourcesValidator.safeParse({ query: { branchId: UUID } }).success).toBe(true);
    expect(getProfitSourcesValidator.safeParse({ query: { branchId: "x" } }).success).toBe(false);
  });
});
