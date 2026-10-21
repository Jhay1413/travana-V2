import { describe, expect, it } from "vitest";
import {
  catalogueQuery,
  createLinkBody,
  createValidator,
  importBody,
  listQuery,
  patchLinkBody,
  patchValidator,
} from "./tour-operator.validator";

const OP_ID = "11111111-1111-4111-8111-111111111111";

describe("createLinkBody", () => {
  it("accepts a catalogue pick and defaults the balance weeks to 14", () => {
    const r = createLinkBody.parse({ tourOperatorId: OP_ID, commissionPercentage: 10 });
    expect(r.balanceDueWeeks).toBe(14);
  });

  it("accepts a new name and normalises the website", () => {
    const r = createLinkBody.parse({ name: " Sandals ", website: "sandals.co.uk", phone: "0800 742 742", commissionPercentage: 12.5, balanceDueWeeks: 10 });
    expect(r.name).toBe("Sandals");
    expect(r.website).toBe("https://sandals.co.uk");
  });

  it("needs exactly one of tourOperatorId / name", () => {
    expect(createLinkBody.safeParse({ commissionPercentage: 10 }).success).toBe(false);
    expect(createLinkBody.safeParse({ tourOperatorId: OP_ID, name: "TUI", commissionPercentage: 10 }).success).toBe(false);
  });

  it("rejects out-of-range numbers with the shared messages", () => {
    const over = createLinkBody.safeParse({ name: "TUI", commissionPercentage: 101 });
    expect(over.success).toBe(false);
    if (!over.success) expect(over.error.errors[0].message).toBe("Commission can't be over 100%.");
    expect(createLinkBody.safeParse({ name: "TUI", commissionPercentage: 5, balanceDueWeeks: 53 }).success).toBe(false);
    expect(createLinkBody.safeParse({ name: "TUI", commissionPercentage: 5, balanceDueWeeks: 1.5 }).success).toBe(false);
  });

  it("rejects a bad phone and a bad web address", () => {
    expect(createLinkBody.safeParse({ name: "TUI", commissionPercentage: 5, phone: "abc" }).success).toBe(false);
    expect(createLinkBody.safeParse({ name: "TUI", commissionPercentage: 5, website: "not a url" }).success).toBe(false);
  });

  it("requires a commission", () => {
    expect(createLinkBody.safeParse({ name: "TUI" }).success).toBe(false);
  });
});

describe("patchLinkBody", () => {
  it("rejects an empty body", () => {
    expect(patchLinkBody.safeParse({}).success).toBe(false);
  });

  it("allows clearing commission, password and phone", () => {
    const r = patchLinkBody.parse({ commissionPercentage: null, password: "", phone: "" });
    expect(r.commissionPercentage).toBeNull();
    expect(r.password).toBe("");
  });

  it("accepts isActive alone", () => {
    expect(patchLinkBody.parse({ isActive: false })).toEqual({ isActive: false });
  });

  it("validator wrapper requires a uuid linkId", () => {
    expect(patchValidator.safeParse({ params: { linkId: "x" }, body: { isActive: true } }).success).toBe(false);
    expect(patchValidator.safeParse({ params: { linkId: OP_ID }, body: { isActive: true } }).success).toBe(true);
  });
});

describe("queries and import", () => {
  it("listQuery only accepts includeInactive=1", () => {
    expect(listQuery.safeParse({ includeInactive: "1" }).success).toBe(true);
    expect(listQuery.safeParse({ includeInactive: "yes" }).success).toBe(false);
    expect(listQuery.safeParse({}).success).toBe(true);
  });

  it("catalogueQuery limits q to 80 chars", () => {
    expect(catalogueQuery.safeParse({ q: "a".repeat(81) }).success).toBe(false);
    expect(catalogueQuery.safeParse({ q: "tui", all: "1" }).success).toBe(true);
  });

  it("importBody caps at 500 rows and needs at least one", () => {
    const row = { line: 2, name: "TUI" };
    expect(importBody.safeParse({ rows: [] }).success).toBe(false);
    expect(importBody.safeParse({ rows: Array.from({ length: 501 }, () => row) }).success).toBe(false);
    expect(importBody.safeParse({ rows: Array.from({ length: 500 }, () => row) }).success).toBe(true);
  });

  it("createValidator wraps the body", () => {
    expect(createValidator.safeParse({ body: { name: "TUI", commissionPercentage: 5 } }).success).toBe(true);
  });
});
