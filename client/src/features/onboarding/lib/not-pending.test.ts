import { describe, expect, it } from "vitest";
import { isNotPendingError, shopResultsNotPending } from "./not-pending";

describe("isNotPendingError", () => {
  it("recognises the interceptor-wrapped 409 with the code", () => {
    expect(isNotPendingError(Object.assign(new Error("x"), { status: 409, code: "ONBOARDING_NOT_PENDING" }))).toBe(true);
  });
  it("reads the code from the response body or an axios-style response", () => {
    expect(isNotPendingError({ status: 409, data: { code: "ONBOARDING_NOT_PENDING" } })).toBe(true);
    expect(isNotPendingError({ response: { status: 409, data: { code: "ONBOARDING_NOT_PENDING" } } })).toBe(true);
  });
  it("ignores other conflicts, codes and values", () => {
    expect(isNotPendingError({ status: 409, code: "SOMETHING_ELSE" })).toBe(false);
    expect(isNotPendingError({ status: 403, code: "ONBOARDING_NOT_PENDING" })).toBe(false);
    expect(isNotPendingError(null)).toBe(false);
    expect(isNotPendingError("nope")).toBe(false);
  });
  it("spots the code on shop result rows", () => {
    expect(shopResultsNotPending([{ code: undefined }, { code: "ONBOARDING_NOT_PENDING" }])).toBe(true);
    expect(shopResultsNotPending([{ code: "BRANCH_LIMIT_REACHED" }])).toBe(false);
  });
});
