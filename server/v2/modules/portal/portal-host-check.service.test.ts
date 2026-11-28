import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { portalHostCheckService } from "./portal-host-check.service";

const KEYS = ["PORTAL_BASE_URL", "BASE_URL", "PUBLIC_BASE_URL", "APP_URL", "REPLIT_URL", "REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN"] as const;
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.BASE_URL = "https://travana.app";
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("portalHostCheckService", () => {
  it("says single and the hostname with no portal host", () => {
    expect(portalHostCheckService.check("portal.travana.app")).toEqual({ kind: "single", hostSeen: "portal.travana.app" });
  });

  it("says which of the two hosts it was asked on, and nothing else", () => {
    process.env.PORTAL_BASE_URL = "https://portal.travana.app";
    expect(portalHostCheckService.check("portal.travana.app")).toEqual({ kind: "portal", hostSeen: "portal.travana.app" });
    expect(portalHostCheckService.check("TRAVANA.app")).toEqual({ kind: "staff", hostSeen: "travana.app" });
    // A proxy that lost the original host shows up as "staff" with an internal name on the portal address.
    expect(portalHostCheckService.check("10.0.0.5")).toEqual({ kind: "staff", hostSeen: "10.0.0.5" });
    expect(Object.keys(portalHostCheckService.check("x"))).toEqual(["kind", "hostSeen"]);
  });
});
