import { describe, it, expect } from "vitest";
import { sanitizeUser } from "./user.sanitize";

describe("sanitizeUser", () => {
  it("removes credentials and every one-time token", () => {
    const row = {
      id: "u1",
      email: "a@b.com",
      firstName: "Ada",
      password: "hash",
      resetToken: "r",
      resetTokenExpiry: new Date(),
      inviteToken: "i",
      inviteTokenExpiry: new Date(),
      verificationToken: "v",
      verificationTokenExpiry: new Date(),
    };
    const out = sanitizeUser(row);
    expect(out).toEqual({ id: "u1", email: "a@b.com", firstName: "Ada" });
  });

  it("does not mutate the input", () => {
    const row = { id: "u1", password: "hash" };
    sanitizeUser(row);
    expect(row.password).toBe("hash");
  });
});
