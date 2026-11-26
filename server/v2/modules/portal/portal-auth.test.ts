import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { resolvePortalJwtSecret } from "./portal-auth";

const fallbackFor = (dbUrl: string) =>
  crypto.createHash("sha256").update("portal-jwt-" + dbUrl).digest("hex").slice(0, 64);

describe("resolvePortalJwtSecret", () => {
  it("uses PORTAL_JWT_SECRET when it is set", () => {
    const r = resolvePortalJwtSecret({ PORTAL_JWT_SECRET: "a-long-dedicated-secret", DATABASE_URL: "postgres://x" });
    expect(r).toEqual({ secret: "a-long-dedicated-secret", usedFallback: false });
  });

  it("falls back to the historic database-URL derivation when it is not set", () => {
    const r = resolvePortalJwtSecret({ DATABASE_URL: "postgres://db" });
    expect(r).toEqual({ secret: fallbackFor("postgres://db"), usedFallback: true });
  });

  it("prefers NEON_DATABASE_URL over DATABASE_URL in the fallback, exactly as before", () => {
    const r = resolvePortalJwtSecret({ NEON_DATABASE_URL: "postgres://neon", DATABASE_URL: "postgres://db" });
    expect(r.secret).toBe(fallbackFor("postgres://neon"));
  });

  it("treats a blank PORTAL_JWT_SECRET as unset", () => {
    expect(resolvePortalJwtSecret({ PORTAL_JWT_SECRET: "   ", DATABASE_URL: "u" }).usedFallback).toBe(true);
  });
});

describe("portal-auth module startup", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logs one warning at startup when PORTAL_JWT_SECRET is missing", async () => {
    vi.stubEnv("PORTAL_JWT_SECRET", "");
    vi.stubEnv("DATABASE_URL", "postgres://db");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("./portal-auth");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("PORTAL_JWT_SECRET");
  });

  it("does not warn when PORTAL_JWT_SECRET is set", async () => {
    vi.stubEnv("PORTAL_JWT_SECRET", "dedicated-secret-value");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await import("./portal-auth");
    expect(warn).not.toHaveBeenCalled();
  });

  it("signs with the env secret: a token verifies under it but not under the fallback", async () => {
    vi.stubEnv("PORTAL_JWT_SECRET", "dedicated-secret-value");
    const withEnv = await import("./portal-auth");
    const token = withEnv.signPortalToken({ clientId: "c1", email: "a@b.com" });
    expect(withEnv.verifyPortalToken(token)?.clientId).toBe("c1");

    vi.resetModules();
    vi.stubEnv("PORTAL_JWT_SECRET", "");
    vi.stubEnv("DATABASE_URL", "postgres://db");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const withFallback = await import("./portal-auth");
    expect(withFallback.verifyPortalToken(token)).toBeNull();
  });

  it("keeps sessions issued under the fallback valid while the variable is unset", async () => {
    vi.stubEnv("PORTAL_JWT_SECRET", "");
    vi.stubEnv("DATABASE_URL", "postgres://db");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = await import("./portal-auth");
    const token = a.signPortalToken({ clientId: "c1", email: "" });
    vi.resetModules();
    const b = await import("./portal-auth");
    expect(b.verifyPortalToken(token)?.clientId).toBe("c1");
  });
});
