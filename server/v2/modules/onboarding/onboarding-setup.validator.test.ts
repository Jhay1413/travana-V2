import { describe, it, expect } from "vitest";
import { businessSchema, shopsSchema, homeworkerCommissionSchema } from "./onboarding-setup.validator";

const business = {
  businessType: "multi",
  businessName: "Acme",
  phone: "0123",
  address: "1 High St",
  website: "",
  email: "a@acme.com",
};
const shop = { name: "Leeds", phone: "0113", address: "1 Briggate", email: "l@acme.com", managerEmail: "" };

describe("businessSchema", () => {
  it("accepts a blank or http(s) website", () => {
    expect(businessSchema.safeParse({ body: business }).success).toBe(true);
    expect(businessSchema.safeParse({ body: { ...business, website: "https://acme.com" } }).success).toBe(true);
  });

  it.each([
    ["ftp website", { website: "ftp://acme.com" }],
    ["bare domain", { website: "acme.com" }],
    ["bad business type", { businessType: "chain" }],
    ["short address", { address: "1" }],
    ["short name", { businessName: "A" }],
    ["empty phone", { phone: "" }],
    ["bad email", { email: "x" }],
  ])("rejects %s", (_l, over) => {
    expect(businessSchema.safeParse({ body: { ...business, ...over } }).success).toBe(false);
  });
});

describe("shopsSchema", () => {
  it("accepts 1..50 shops and a blank manager email", () => {
    expect(shopsSchema.safeParse({ body: { shops: [shop] } }).success).toBe(true);
    expect(shopsSchema.safeParse({ body: { shops: Array(50).fill(shop) } }).success).toBe(true);
  });

  it("rejects 0 or 51 shops", () => {
    expect(shopsSchema.safeParse({ body: { shops: [] } }).success).toBe(false);
    expect(shopsSchema.safeParse({ body: { shops: Array(51).fill(shop) } }).success).toBe(false);
  });

  it("rejects the reserved name Homeworker in any case", () => {
    expect(shopsSchema.safeParse({ body: { shops: [{ ...shop, name: "hOmeWorker" }] } }).success).toBe(false);
  });

  it("rejects a malformed manager email", () => {
    expect(shopsSchema.safeParse({ body: { shops: [{ ...shop, managerEmail: "nope" }] } }).success).toBe(false);
  });
});

describe("homeworkerCommissionSchema", () => {
  it.each([0, 100, null])("accepts %s", (percent) => {
    expect(homeworkerCommissionSchema.safeParse({ body: { percent } }).success).toBe(true);
  });

  it.each([-1, 101, 1.5, "10", undefined])("rejects %s", (percent) => {
    expect(homeworkerCommissionSchema.safeParse({ body: { percent } }).success).toBe(false);
  });
});
