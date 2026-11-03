import { describe, it, expect } from "vitest";
import { createUserValidator } from "./user.validator";

describe("createUserValidator (strict, explicit)", () => {
  const valid = { email: "a@b.com", firstName: "Ada", lastName: "Lovelace" };

  it("accepts the plain profile fields", () => {
    expect(createUserValidator.safeParse({ body: valid }).success).toBe(true);
  });

  it.each(["role", "orgRole", "password", "banned", "banReason", "inviteToken", "emailVerified", "resetToken", "id"])(
    "rejects a body containing %s",
    (field) => {
      expect(createUserValidator.safeParse({ body: { ...valid, [field]: "x" } }).success).toBe(false);
    },
  );

  it("rejects a bad email or missing names", () => {
    expect(createUserValidator.safeParse({ body: { ...valid, email: "nope" } }).success).toBe(false);
    expect(createUserValidator.safeParse({ body: { email: "a@b.com" } }).success).toBe(false);
  });
});
