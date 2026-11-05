import { describe, it, expect } from "vitest";
import { PHONE_ERROR_MESSAGE } from "@shared/phone";
import { getClientPhoneError, getRequestErrorMessage } from "./client-phone";

describe("getClientPhoneError", () => {
  it("returns null for a valid number", () => {
    expect(getClientPhoneError("+44 7123 456789")).toBeNull();
    expect(getClientPhoneError("07123 456789")).toBeNull();
  });

  it("flags an over-long number", () => {
    expect(getClientPhoneError("1".repeat(30))).toBe(PHONE_ERROR_MESSAGE);
  });

  it("flags a too-short number and letters", () => {
    expect(getClientPhoneError("12345")).toBe(PHONE_ERROR_MESSAGE);
    expect(getClientPhoneError("0712345678")).toBe(PHONE_ERROR_MESSAGE);
    expect(getClientPhoneError("+1 415 555 2671")).toBe(PHONE_ERROR_MESSAGE);
    expect(getClientPhoneError("phone-number")).toBe(PHONE_ERROR_MESSAGE);
  });

  it("leaves an empty value to the required-field check", () => {
    expect(getClientPhoneError("   ")).toBeNull();
  });

  it("does not flag an unchanged stored number, even a bad one", () => {
    expect(getClientPhoneError("0123", "0123")).toBeNull();
  });

  it("flags a changed number that is invalid", () => {
    expect(getClientPhoneError("0123", "07123456789")).toBe(PHONE_ERROR_MESSAGE);
  });
});

describe("getRequestErrorMessage", () => {
  it("surfaces the server message from the rejected Error", () => {
    expect(getRequestErrorMessage(new Error(PHONE_ERROR_MESSAGE), "Failed")).toBe(PHONE_ERROR_MESSAGE);
  });
  it("falls back for non-errors and empty messages", () => {
    expect(getRequestErrorMessage("boom", "Failed")).toBe("Failed");
    expect(getRequestErrorMessage(new Error(""), "Failed")).toBe("Failed");
  });
});
