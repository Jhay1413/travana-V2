import { describe, it, expect } from "vitest";
import { freeQuotesQueryValidator, freeQuoteStatusCountsValidator, recentEngagementQueryValidator, setAcceptedValidator } from "./quote.validator";

describe("freeQuotesQueryValidator", () => {
  it.each(["not_generated", "draft", "scheduled", "posted"])("accepts socialStatus %s", (socialStatus) => {
    expect(freeQuotesQueryValidator.safeParse({ query: { socialStatus } }).success).toBe(true);
  });

  it("rejects an unknown socialStatus", () => {
    expect(freeQuotesQueryValidator.safeParse({ query: { socialStatus: "bogus" } }).success).toBe(false);
  });

  it("accepts a missing socialStatus and keeps unrelated params", () => {
    const r = freeQuotesQueryValidator.safeParse({ query: { page: "2", search: "rome" } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.query).toMatchObject({ page: "2", search: "rome" });
  });
});

describe("freeQuoteStatusCountsValidator", () => {
  it("accepts search plus tags as a string or an array", () => {
    expect(freeQuoteStatusCountsValidator.safeParse({ query: { search: "a", tags: "x,y" } }).success).toBe(true);
    expect(freeQuoteStatusCountsValidator.safeParse({ query: { tags: ["x", "y"] } }).success).toBe(true);
    expect(freeQuoteStatusCountsValidator.safeParse({ query: {} }).success).toBe(true);
  });

  it("rejects non-string tags", () => {
    expect(freeQuoteStatusCountsValidator.safeParse({ query: { tags: [1] } }).success).toBe(false);
  });
});

describe("recentEngagementQueryValidator", () => {
  const parse = (query: Record<string, unknown>) => recentEngagementQueryValidator.safeParse({ query });

  it("accepts no params, and the documented mine/period values", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ limit: "10", mine: "true", period: "week" }).success).toBe(true);
    for (const period of ["today", "yesterday", "week", "all"]) {
      expect(parse({ period }).success).toBe(true);
    }
    expect(parse({ mine: "false" }).success).toBe(true);
  });

  it("rejects unknown period or mine values", () => {
    expect(parse({ period: "month" }).success).toBe(false);
    expect(parse({ mine: "yes" }).success).toBe(false);
  });
});

describe("setAcceptedValidator", () => {
  const id = "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f";

  it.each([true, false])("accepts accepted=%s", (accepted) => {
    expect(setAcceptedValidator.safeParse({ params: { id }, body: { accepted } }).success).toBe(true);
  });

  it("rejects a missing or non-boolean accepted", () => {
    expect(setAcceptedValidator.safeParse({ params: { id }, body: {} }).success).toBe(false);
    expect(setAcceptedValidator.safeParse({ params: { id }, body: { accepted: "true" } }).success).toBe(false);
    expect(setAcceptedValidator.safeParse({ params: { id }, body: { accepted: 1 } }).success).toBe(false);
  });

  it("rejects extra body keys and a non-uuid id", () => {
    expect(setAcceptedValidator.safeParse({ params: { id }, body: { accepted: true, extra: 1 } }).success).toBe(false);
    expect(setAcceptedValidator.safeParse({ params: { id: "nope" }, body: { accepted: true } }).success).toBe(false);
  });
});
