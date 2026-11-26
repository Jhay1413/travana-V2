import { describe, it, expect } from "vitest";
import { PORTAL_DECLINE_REASONS } from "@shared/portal-quotes";
import { portalQuoteActionValidator, portalQuoteDetailValidator } from "./portal-quotes.validator";

const parse = (body: unknown, token = "TOK1") => portalQuoteActionValidator.safeParse({ params: { token }, body });

describe("portalQuoteActionValidator", () => {
  it("accepts the three actions", () => {
    for (const action of ["interested", "declined", "reopened"]) expect(parse({ action }).success).toBe(true);
  });

  it("accepts every fixed decline reason, and a decline with no reason", () => {
    for (const reason of PORTAL_DECLINE_REASONS) expect(parse({ action: "declined", reason, wantsSimilar: true, note: "ok" }).success).toBe(true);
    expect(parse({ action: "declined" }).success).toBe(true);
  });

  it("rejects an unknown action, including the stored value 'accepted'", () => {
    expect(parse({ action: "accepted" }).success).toBe(false);
    expect(parse({ action: "maybe" }).success).toBe(false);
    expect(parse({}).success).toBe(false);
  });

  it("rejects a reason outside the list", () => {
    expect(parse({ action: "declined", reason: "too expensive" }).success).toBe(false);
  });

  it("bounds the note and the token", () => {
    expect(parse({ action: "interested", note: "x".repeat(1000) }).success).toBe(true);
    expect(parse({ action: "interested", note: "x".repeat(1001) }).success).toBe(false);
    expect(parse({ action: "interested" }, "").success).toBe(false);
    expect(parse({ action: "interested" }, "t".repeat(201)).success).toBe(false);
  });

  it("has no field for who the customer is", () => {
    const result = parse({ action: "interested", customerName: "Someone", clientId: "x" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).not.toHaveProperty("customerName");
      expect(result.data.body).not.toHaveProperty("clientId");
    }
  });
});

describe("portalQuoteDetailValidator", () => {
  it("needs a bounded token", () => {
    expect(portalQuoteDetailValidator.safeParse({ params: { token: "TOK1" } }).success).toBe(true);
    expect(portalQuoteDetailValidator.safeParse({ params: { token: "" } }).success).toBe(false);
  });
});
