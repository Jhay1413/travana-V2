import { describe, it, expect } from "vitest";
import { effectiveExpiry, isExpired } from "./expiry";

describe("effectiveExpiry", () => {
  it("uses the explicit date_expiry when present", () => {
    expect(effectiveExpiry("2026-06-01T00:00:00Z", "2026-01-01T00:00:00Z").toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
  });

  it("falls back to date_created + 7 days when there is no expiry", () => {
    expect(effectiveExpiry(null, "2026-01-01T00:00:00Z").toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });
});

describe("isExpired", () => {
  const now = new Date("2026-06-17T12:00:00Z");

  it("is true when the effective expiry is in the past", () => {
    expect(isExpired("2026-06-10T00:00:00Z", null, now)).toBe(true);
  });

  it("is false when the effective expiry is in the future", () => {
    expect(isExpired("2026-06-20T00:00:00Z", null, now)).toBe(false);
  });

  it("derives from date_created + 7d when no explicit expiry", () => {
    // created 2026-06-01 → effective expiry 2026-06-08 → expired by 2026-06-17
    expect(isExpired(null, "2026-06-01T00:00:00Z", now)).toBe(true);
  });
});
