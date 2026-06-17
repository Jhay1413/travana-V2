import { describe, it, expect } from "vitest";
import { createReferralValidator, updateReferralStatusValidator } from "./referral.validator";

const UUID = "11111111-1111-1111-1111-111111111111";

describe("createReferralValidator", () => {
  it("accepts a minimal valid referral", () => {
    expect(
      createReferralValidator.safeParse({ body: { referrerClientId: UUID, referredName: "Ada" } }).success,
    ).toBe(true);
  });

  it("rejects a non-UUID referrerClientId", () => {
    expect(
      createReferralValidator.safeParse({ body: { referrerClientId: "abc", referredName: "Ada" } }).success,
    ).toBe(false);
  });

  it("rejects an empty referredName", () => {
    expect(
      createReferralValidator.safeParse({ body: { referrerClientId: UUID, referredName: "" } }).success,
    ).toBe(false);
  });

  it("rejects a malformed referredEmail when supplied", () => {
    expect(
      createReferralValidator.safeParse({ body: { referrerClientId: UUID, referredName: "Ada", referredEmail: "nope" } })
        .success,
    ).toBe(false);
  });
});

describe("updateReferralStatusValidator", () => {
  it("accepts a known status", () => {
    expect(
      updateReferralStatusValidator.safeParse({ params: { id: UUID }, body: { status: "IN_WALLET" } }).success,
    ).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(
      updateReferralStatusValidator.safeParse({ params: { id: UUID }, body: { status: "ARCHIVED" } }).success,
    ).toBe(false);
  });
});
