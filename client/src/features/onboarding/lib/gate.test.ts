import { describe, expect, it } from "vitest";
import { isStateLoadFailure, onboardingRedirectFor, shouldHoldForOnboarding, shouldRetryOnboardingState } from "./gate";

const pending = { isOrgAdmin: true, isPending: true, isError: false };

describe("onboardingRedirectFor", () => {
  it("sends a pending org admin from any app route to the wizard", () => {
    for (const p of ["/", "/agency/overview", "/pipeline", "/hub", "/clients/12"]) {
      expect(onboardingRedirectFor(p, pending)).toBe("/onboarding");
    }
  });
  it("leaves the wizard and auth/public routes alone", () => {
    for (const p of ["/onboarding", "/logout", "/verify-email", "/accept-invite", "/signup", "/signup-agency", "/reset-password/abc", "/portal/login"]) {
      expect(onboardingRedirectFor(p, pending)).toBeNull();
    }
  });
  it("does not match look-alike prefixes", () => {
    expect(onboardingRedirectFor("/onboardingx", pending)).toBe("/onboarding");
  });
  it("fails open on error, and ignores non-pending or non-admin users", () => {
    expect(onboardingRedirectFor("/pipeline", { ...pending, isError: true })).toBeNull();
    expect(onboardingRedirectFor("/pipeline", { ...pending, isPending: false })).toBeNull();
    expect(onboardingRedirectFor("/pipeline", { ...pending, isOrgAdmin: false })).toBeNull();
  });
});

describe("shouldRetryOnboardingState", () => {
  it("retries up to twice", () => {
    expect(shouldRetryOnboardingState(0, { status: 500 })).toBe(true);
    expect(shouldRetryOnboardingState(1, { status: 503 })).toBe(true);
    expect(shouldRetryOnboardingState(2, { status: 500 })).toBe(false);
  });
  it("retries network errors but not 4xx", () => {
    expect(shouldRetryOnboardingState(0, new Error("Network Error"))).toBe(true);
    for (const status of [400, 401, 403, 404, 409]) expect(shouldRetryOnboardingState(0, { status })).toBe(false);
    expect(shouldRetryOnboardingState(0, { response: { status: 403 } })).toBe(false);
  });
});

describe("bypass and loading", () => {
  it("does not redirect a bypassed admin", () => {
    expect(onboardingRedirectFor("/pipeline", { ...pending, bypassed: true })).toBeNull();
  });
  it("holds only non-allowlisted paths while loading", () => {
    expect(shouldHoldForOnboarding("/pipeline", true)).toBe(true);
    expect(shouldHoldForOnboarding("/pipeline", false)).toBe(false);
    expect(shouldHoldForOnboarding("/onboarding", true)).toBe(false);
  });
});

describe("isStateLoadFailure", () => {
  it("only fails when there is no data", () => {
    expect(isStateLoadFailure({ isError: true, data: undefined })).toBe(true);
    expect(isStateLoadFailure({ isError: true, data: { status: "pending" } })).toBe(false);
    expect(isStateLoadFailure({ isError: false, data: undefined })).toBe(false);
  });
});
