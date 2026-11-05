import { describe, it, expect } from "vitest";
import {
  isPhoneChanged,
  isValidPhoneNumber,
  looksLikePhoneHandle,
  normalizePhoneNumber,
  PHONE_ERROR_MESSAGE,
  withNormalizedPhone,
  withTrimmedPhone,
} from "./phone";

describe("normalizePhoneNumber", () => {
  it.each([
    ["07123456789", "07123456789"],
    ["07123 456789", "07123456789"],
    [" 0712 345 6789 ", "07123456789"],
    ["07123-456-789", "07123456789"],
    ["(07123) 456789", "07123456789"],
    ["+44 7123 456789", "07123456789"],
    ["+447123456789", "07123456789"],
    ["+44 (0)7123 456789", "07123456789"],
    ["0044 7123 456789", "07123456789"],
    ["020 7946 0958", "02079460958"],
  ])("%s -> %s", (input, out) => expect(normalizePhoneNumber(input)).toBe(out));

  it.each([
    "",
    "   ",
    "0712345678",
    "071234567890",
    "+1 415 555 2671",
    "+34 612 345 678",
    "0034 612 345 678",
    "+44 712 345678",
    "+44 7123 4567890",
    "71234567890",
    "abc07123456",
    "07123 456789 ext 2",
    "07123+456789",
    "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11",
  ])("rejects %j", (v) => expect(normalizePhoneNumber(v)).toBeNull());

  it("rejects null and undefined", () => {
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(isValidPhoneNumber(undefined)).toBe(false);
  });

  it("has a plain-English error message", () => {
    expect(PHONE_ERROR_MESSAGE).toBe("Enter an 11-digit UK number, e.g. 07123 456789");
  });
});

describe("looksLikePhoneHandle (display only)", () => {
  it("keeps the loose 7-15 digit rule for foreign inbox handles", () => {
    expect(looksLikePhoneHandle("+1.415.555.2671")).toBe(true);
    expect(looksLikePhoneHandle("123456")).toBe(false);
    expect(looksLikePhoneHandle("1234567890123456")).toBe(false);
  });
});

describe("withTrimmedPhone / withNormalizedPhone", () => {
  it("trims phoneNumber and keeps other fields", () => {
    expect(withTrimmedPhone({ phoneNumber: "  07123456789 ", firstName: "A" })).toEqual({ phoneNumber: "07123456789", firstName: "A" });
  });
  it("normalises a valid phone and only trims an invalid one", () => {
    expect(withNormalizedPhone({ phoneNumber: " +44 7123 456789 " }).phoneNumber).toBe("07123456789");
    expect(withNormalizedPhone({ phoneNumber: " 123 " }).phoneNumber).toBe("123");
  });
  it("leaves a payload without phoneNumber untouched", () => {
    const d = { firstName: "A" };
    expect(withTrimmedPhone(d)).toBe(d);
    expect(withNormalizedPhone(d)).toBe(d);
  });
});

describe("isPhoneChanged", () => {
  it("is false when absent or equal (ignoring padding), true otherwise", () => {
    expect(isPhoneChanged(undefined, "123")).toBe(false);
    expect(isPhoneChanged(" 123 ", "123")).toBe(false);
    expect(isPhoneChanged("07123456789", null)).toBe(true);
    expect(isPhoneChanged("07123456789", "07000000000")).toBe(true);
  });
});
