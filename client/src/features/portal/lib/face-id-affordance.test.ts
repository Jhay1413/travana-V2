import { describe, it, expect } from "vitest";
import { faceIdAffordance, offerRegistrationAfterPin, showFaceIdOnLogin } from "./face-id-affordance";

describe("showFaceIdOnLogin", () => {
  it("a device that remembers a set-up keeps the button, as before", () => {
    expect(showFaceIdOnLogin({ hasMarker: true, hasWebAuthn: true, platformAuthenticatorAvailable: false })).toBe(true);
    expect(showFaceIdOnLogin({ hasMarker: true, hasWebAuthn: false, platformAuthenticatorAvailable: true })).toBe(false);
  });
  it("a device with no marker offers it only when a built-in biometric is available", () => {
    expect(showFaceIdOnLogin({ hasMarker: false, hasWebAuthn: true, platformAuthenticatorAvailable: true })).toBe(true);
    expect(showFaceIdOnLogin({ hasMarker: false, hasWebAuthn: true, platformAuthenticatorAvailable: false })).toBe(false);
  });
});

describe("offerRegistrationAfterPin", () => {
  it("never registers again when the account already has a Face ID", () => {
    expect(offerRegistrationAfterPin({ hasBiometric: true, biometricCheckFailed: false, credentialsApi: true })).toBe(false);
  });
  it("registers only when the account has none and the server could check", () => {
    expect(offerRegistrationAfterPin({ hasBiometric: false, biometricCheckFailed: false, credentialsApi: true })).toBe(true);
    expect(offerRegistrationAfterPin({ hasBiometric: false, biometricCheckFailed: true, credentialsApi: true })).toBe(false);
    expect(offerRegistrationAfterPin({ hasBiometric: false, biometricCheckFailed: false, credentialsApi: false })).toBe(false);
  });
});

describe("faceIdAffordance", () => {
  const base = { supported: true, enabledHere: false, accountHasCredential: false, useHereFailed: false };
  it("unsupported browsers get no control", () => {
    expect(faceIdAffordance({ ...base, supported: false })).toBe("unavailable");
  });
  it("a device that already uses it shows it as on", () => {
    expect(faceIdAffordance({ ...base, enabledHere: true, accountHasCredential: true })).toBe("on");
  });
  it("an account with a Face ID but a device with no marker offers 'use it here', not a new set-up", () => {
    expect(faceIdAffordance({ ...base, accountHasCredential: true })).toBe("use-here");
  });
  it("once using it here failed, a new set-up is offered", () => {
    expect(faceIdAffordance({ ...base, accountHasCredential: true, useHereFailed: true })).toBe("set-up");
  });
  it("an account with none offers the set-up", () => {
    expect(faceIdAffordance(base)).toBe("set-up");
  });
});
