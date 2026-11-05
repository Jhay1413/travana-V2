import { describe, it, expect } from "vitest";
import { isValidPhoneNumber, PHONE_ERROR_MESSAGE, withTrimmedPhone } from "./phone";

describe("isValidPhoneNumber", () => {
  it.each(["07123456789", "+44 7123 456789", "(020) 7946-0958", "+1.415.555.2671", " 1234567 ", "123456789012345"])(
    "accepts %s",
    (v) => expect(isValidPhoneNumber(v)).toBe(true),
  );

  it.each([
    "",
    "   ",
    "123456",
    "1234567890123456",
    "1234567890123456789012345",
    "abc1234567",
    "07123 456789 ext 2",
    "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11",
  ])("rejects %j", (v) => expect(isValidPhoneNumber(v)).toBe(false));

  it("rejects null and undefined", () => {
    expect(isValidPhoneNumber(null)).toBe(false);
    expect(isValidPhoneNumber(undefined)).toBe(false);
  });

  it("has a readable error message", () => {
    expect(PHONE_ERROR_MESSAGE).toContain("7");
    expect(PHONE_ERROR_MESSAGE).toContain("15");
  });
});

describe("withTrimmedPhone", () => {
  it("trims phoneNumber and keeps other fields", () => {
    expect(withTrimmedPhone({ phoneNumber: "  07123456789 ", firstName: "A" })).toEqual({ phoneNumber: "07123456789", firstName: "A" });
  });
  it("leaves a payload without phoneNumber untouched", () => {
    const d = { firstName: "A" };
    expect(withTrimmedPhone(d)).toBe(d);
  });
});
