import { describe, it, expect } from "vitest";
import { signupSchema, resendVerificationSchema } from "./onboarding.validator";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    businessName: "Acme Travel",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@acme.com",
    password: "supersecret",
    ...overrides,
  };
}

describe("signupSchema (slim)", () => {
  it("accepts a well-formed payload", () => {
    expect(signupSchema.safeParse({ body: validBody() }).success).toBe(true);
  });

  it.each([
    ["businessName too short", { businessName: "A" }],
    ["empty firstName", { firstName: " " }],
    ["empty lastName", { lastName: "" }],
    ["bad email", { email: "nope" }],
    ["short password", { password: "short" }],
  ])("rejects %s", (_label, over) => {
    expect(signupSchema.safeParse({ body: validBody(over) }).success).toBe(false);
  });
});

describe("resendVerificationSchema", () => {
  it("rejects a malformed email", () => {
    expect(resendVerificationSchema.safeParse({ body: { email: "not-an-email" } }).success).toBe(false);
  });
});
