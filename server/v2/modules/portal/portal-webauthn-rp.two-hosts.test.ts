import { describe, it, expect } from "vitest";
import { resolveWebauthnRp } from "./portal-webauthn-rp";

const STAFF = "https://travana.app";

describe("resolveWebauthnRp: one host is unchanged", () => {
  it("with no portal base it is exactly today's answer", () => {
    expect(resolveWebauthnRp({ configured: STAFF, requestOrigin: "https://evil.example", isProduction: true, portalOrigin: null, staffOrigin: null })).toEqual({
      rpID: "travana.app",
      origin: STAFF,
    });
  });
});

describe("resolveWebauthnRp: two hosts in production", () => {
  const base = { configured: STAFF, requestOrigin: "https://evil.example", isProduction: true, staffOrigin: STAFF };

  it("a portal subdomain of the staff host keeps the STAFF hostname as RP ID, so earlier credentials stay valid", () => {
    expect(resolveWebauthnRp({ ...base, portalOrigin: "https://portal.travana.app" })).toEqual({
      rpID: "travana.app",
      origin: "https://portal.travana.app",
      origins: ["https://portal.travana.app", STAFF],
    });
  });

  it("a deeper subdomain also counts", () => {
    expect(resolveWebauthnRp({ ...base, portalOrigin: "https://a.b.travana.app" })?.rpID).toBe("travana.app");
  });

  it("an unrelated portal host gets its own RP ID (old credentials cannot carry over)", () => {
    expect(resolveWebauthnRp({ ...base, portalOrigin: "https://portal.example.org" })).toEqual({
      rpID: "portal.example.org",
      origin: "https://portal.example.org",
      origins: ["https://portal.example.org", STAFF],
    });
  });

  it("a look-alike host (a suffix match without the dot) is unrelated", () => {
    expect(resolveWebauthnRp({ ...base, portalOrigin: "https://eviltravana.app" })?.rpID).toBe("eviltravana.app");
  });

  it("never takes anything from the request in production", () => {
    const rp = resolveWebauthnRp({ ...base, requestOrigin: "https://attacker.example", portalOrigin: "https://portal.travana.app" });
    expect(rp?.origins).toEqual(["https://portal.travana.app", STAFF]);
  });
});

describe("resolveWebauthnRp: two hosts outside production", () => {
  const dev = { configured: "http://localhost:5057", isProduction: false, staffOrigin: "http://localhost:5057", portalOrigin: "http://portal.localhost:5057" };

  it("a request from either configured origin gets both origins accepted", () => {
    for (const requestOrigin of ["http://localhost:5057", "http://portal.localhost:5057"]) {
      expect(resolveWebauthnRp({ ...dev, requestOrigin })).toEqual({
        rpID: "localhost",
        origin: "http://portal.localhost:5057",
        origins: ["http://portal.localhost:5057", "http://localhost:5057"],
      });
    }
  });

  it("a request from any other origin keeps today's request-origin behaviour", () => {
    expect(resolveWebauthnRp({ ...dev, requestOrigin: "https://abc-123.replit.dev" })).toEqual({ rpID: "abc-123.replit.dev", origin: "https://abc-123.replit.dev" });
  });
});
