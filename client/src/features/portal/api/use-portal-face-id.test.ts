import { describe, it, expect } from "vitest";
import { PortalApiError } from "@/hooks/use-portal-api";
import { interpretFaceIdError } from "./use-portal-face-id";

describe("interpretFaceIdError", () => {
  it("REAUTH_REQUIRED means sign in with your PIN again", () => {
    expect(interpretFaceIdError(new PortalApiError("For your security, sign in again.", 403, "REAUTH_REQUIRED"))).toEqual({ status: "reauth" });
  });
  it("a 403 without that code is an ordinary failure with the server's message", () => {
    expect(interpretFaceIdError(new PortalApiError("Nope", 403))).toEqual({ status: "failed", message: "Nope" });
  });
  it("a cancelled device prompt is not an error", () => {
    expect(interpretFaceIdError(new DOMException("cancelled", "NotAllowedError"))).toEqual({ status: "cancelled" });
  });
  it("anything else gets a plain sentence", () => {
    expect(interpretFaceIdError("boom")).toEqual({ status: "failed", message: "We couldn't set up Face ID. Please try again." });
  });
});

import { findThisDevice } from "./use-portal-face-id";

describe("findThisDevice", () => {
  const devices = [
    { id: "a", credentialId: "cred-a", createdAt: "2026-11-02T10:00:00.000Z" },
    { id: "b", credentialId: "cred-b", createdAt: null },
  ];
  it("matches on the credential id this device remembered", () => {
    expect(findThisDevice(devices, "cred-b")?.id).toBe("b");
  });
  it("finds nothing when the device remembers nothing or something unknown", () => {
    expect(findThisDevice(devices, null)).toBeUndefined();
    expect(findThisDevice(devices, "cred-z")).toBeUndefined();
    expect(findThisDevice([], "cred-a")).toBeUndefined();
  });
});

import { faceIdEnabledOnThisDevice } from "./use-portal-face-id";

describe("faceIdEnabledOnThisDevice", () => {
  const devices = [{ id: "a", credentialId: "cred-a", createdAt: null }];
  it("off when this device remembers nothing", () => {
    expect(faceIdEnabledOnThisDevice(null, devices)).toBe(false);
    expect(faceIdEnabledOnThisDevice(null, undefined)).toBe(false);
  });
  it("trusts the device's memory until the account's list has loaded", () => {
    expect(faceIdEnabledOnThisDevice("cred-a", undefined)).toBe(true);
  });
  it("once the list has loaded, on only while that credential still exists", () => {
    expect(faceIdEnabledOnThisDevice("cred-a", devices)).toBe(true);
    expect(faceIdEnabledOnThisDevice("cred-a", [])).toBe(false);
    expect(faceIdEnabledOnThisDevice("cred-a", [{ id: "b", credentialId: "cred-b", createdAt: null }])).toBe(false);
  });
});
