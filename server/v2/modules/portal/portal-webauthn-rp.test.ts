import { describe, it, expect } from "vitest";
import { resolveWebauthnRp } from "./portal-webauthn-rp";
import { consumeChallenge, resetChallengeStore } from "./portal-challenge-store";

describe("resolveWebauthnRp", () => {
  it("production uses only the configured public URL, ignoring the request origin", () => {
    expect(
      resolveWebauthnRp({ configured: "https://portal.tinas.example", requestOrigin: "https://evil.example", isProduction: true }),
    ).toEqual({ rpID: "portal.tinas.example", origin: "https://portal.tinas.example" });
  });

  it("outside production the request's own origin wins (dev workspace host works unchanged)", () => {
    expect(
      resolveWebauthnRp({ configured: "https://prod.example", requestOrigin: "https://abc-123.replit.dev", isProduction: false }),
    ).toEqual({ rpID: "abc-123.replit.dev", origin: "https://abc-123.replit.dev" });
  });

  it("outside production without an Origin it falls back to the configured URL", () => {
    expect(resolveWebauthnRp({ configured: "https://prod.example/", requestOrigin: null, isProduction: false })).toEqual({
      rpID: "prod.example", origin: "https://prod.example",
    });
  });

  it("keeps the port in the origin but not in the RP ID (localhost dev)", () => {
    expect(resolveWebauthnRp({ configured: "", requestOrigin: "http://localhost:5000", isProduction: false })).toEqual({
      rpID: "localhost", origin: "http://localhost:5000",
    });
  });
});

describe("an unusable configured public URL", () => {
  it("returns null (callers fail generically) instead of throwing when the URL has no scheme", () => {
    expect(resolveWebauthnRp({ configured: "example.com", requestOrigin: null, isProduction: true })).toBeNull();
    expect(resolveWebauthnRp({ configured: "not a url at all", requestOrigin: null, isProduction: true })).toBeNull();
  });

  it("returns null for a non-web scheme", () => {
    expect(resolveWebauthnRp({ configured: "javascript:alert(1)", requestOrigin: null, isProduction: true })).toBeNull();
  });
});

describe("challenge store", () => {
  it("allows a challenge once and refuses it afterwards", () => {
    resetChallengeStore();
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(consumeChallenge("a", exp)).toBe(true);
    expect(consumeChallenge("a", exp)).toBe(false);
    expect(consumeChallenge("b", exp)).toBe(true);
  });

  it("forgets a challenge once its token has expired", () => {
    resetChallengeStore();
    const now = Date.now();
    consumeChallenge("a", Math.floor(now / 1000) + 10, now);
    expect(consumeChallenge("a", Math.floor(now / 1000) + 10, now + 11_000)).toBe(true);
  });
});
