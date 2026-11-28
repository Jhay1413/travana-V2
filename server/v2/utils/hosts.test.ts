import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getPortalBaseUrl,
  getStaffOrigin,
  hostKind,
  hostsForPage,
  isSafePath,
  portalUrl,
  redirectTargetFor,
  resetHostsLogState,
  staffUrl,
  tryPortalUrl,
  SITE_ADDRESS_ERROR,
} from "./hosts";

const KEYS = ["PORTAL_BASE_URL", "BASE_URL", "PUBLIC_BASE_URL", "APP_URL", "REPLIT_URL", "REPLIT_DOMAINS", "REPLIT_DEV_DOMAIN", "REPLIT_DEPLOYMENT", "REPLIT_DEPLOYMENT_ID", "NODE_ENV"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.BASE_URL = "https://travana.app";
  resetHostsLogState();
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

const PORTAL = "https://portal.travana.app";
const on = (hostname: string) => ({ hostname });

describe("getPortalBaseUrl", () => {
  it("is null when unset or blank", () => {
    expect(getPortalBaseUrl()).toBeNull();
    process.env.PORTAL_BASE_URL = "   ";
    expect(getPortalBaseUrl()).toBeNull();
  });

  it("returns the origin without a trailing slash", () => {
    process.env.PORTAL_BASE_URL = `${PORTAL}/`;
    expect(getPortalBaseUrl()).toBe(PORTAL);
    process.env.PORTAL_BASE_URL = PORTAL;
    expect(getPortalBaseUrl()).toBe(PORTAL);
  });

  it.each([
    ["not a URL", "portal.travana.app"],
    ["not http(s)", "ftp://portal.travana.app"],
    ["a path", "https://portal.travana.app/portal"],
    ["a query", "https://portal.travana.app/?a=1"],
    ["an empty query", "https://portal.travana.app/?"],
    ["a hash", "https://portal.travana.app/#x"],
    ["credentials", "https://user:pw@portal.travana.app"],
    ["the same host as the staff site", "https://travana.app"],
    ["the same host in another case", "https://TRAVANA.app:8443"],
  ])("treats %s as unset", (_name, value) => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.PORTAL_BASE_URL = value;
    expect(getPortalBaseUrl()).toBeNull();
  });

  it("refuses http in production but allows it elsewhere", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.PORTAL_BASE_URL = "http://portal.travana.app";
    expect(getPortalBaseUrl()).toBe("http://portal.travana.app");
    process.env.NODE_ENV = "production";
    expect(getPortalBaseUrl()).toBeNull();
  });

  it("is null when there is no staff site address to compare with", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    delete process.env.BASE_URL;
    process.env.PORTAL_BASE_URL = PORTAL;
    expect(getPortalBaseUrl()).toBeNull();
  });

  it("logs an invalid value once, and never the value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.PORTAL_BASE_URL = "https://secret:pw@portal.travana.app";
    getPortalBaseUrl();
    getPortalBaseUrl();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("secret");
  });
});

describe("hostKind", () => {
  it("is single whenever no portal host is configured, whatever the request host", () => {
    expect(hostKind(on("travana.app"))).toBe("single");
    expect(hostKind(on("portal.travana.app"))).toBe("single");
    expect(hostKind(on(""))).toBe("single");
  });

  it("tells the portal host from everything else, ignoring case and a trailing dot", () => {
    process.env.PORTAL_BASE_URL = `${PORTAL}:8443`;
    expect(hostKind(on("portal.travana.app"))).toBe("portal");
    expect(hostKind(on("PORTAL.Travana.App"))).toBe("portal");
    expect(hostKind(on("portal.travana.app."))).toBe("portal");
    expect(hostKind(on("travana.app"))).toBe("staff");
    expect(hostKind(on("evil.com"))).toBe("staff");
    expect(hostKind(on("portal.travana.app.evil.com"))).toBe("staff");
    expect(hostKind(on(""))).toBe("staff");
  });
});

describe("portalUrl and staffUrl", () => {
  it("with no portal host both are exactly the public base plus the path (today's strings)", () => {
    expect(portalUrl("/portal/login")).toBe("https://travana.app/portal/login");
    expect(portalUrl("/view-quote/TOK")).toBe("https://travana.app/view-quote/TOK");
    expect(staffUrl("/accept-invite?t=1")).toBe("https://travana.app/accept-invite?t=1");
  });

  it("with no site address at all it stays relative, as before", () => {
    delete process.env.BASE_URL;
    expect(portalUrl("/portal/login")).toBe("/portal/login");
  });

  it("with a portal host, customer links use it and staff links do not", () => {
    process.env.PORTAL_BASE_URL = PORTAL;
    expect(portalUrl("/portal/login?mt=ABC&next=%2Fportal")).toBe(`${PORTAL}/portal/login?mt=ABC&next=%2Fportal`);
    expect(staffUrl("/accept-invite")).toBe("https://travana.app/accept-invite");
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com/", "portal", "", "/a\r\nb", "/a\u0000b", "/a\u007fb"])(
    "refuses the unsafe path %j (throws outside production)",
    (path) => {
      expect(() => portalUrl(path)).toThrow();
      expect(() => staffUrl(path)).toThrow();
    },
  );

  it("in production fails closed with the site-address error instead of building a bare link", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.NODE_ENV = "production";
    expect(() => portalUrl("//evil.com")).toThrow(SITE_ADDRESS_ERROR);
    expect(() => staffUrl("/a\b")).toThrow(SITE_ADDRESS_ERROR);
  });

  it("tryPortalUrl answers null for an unsafe path and the link otherwise", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(tryPortalUrl("//evil.com")).toBeNull();
    expect(tryPortalUrl("/portal/login")).toBe("https://travana.app/portal/login");
  });
});

describe("isSafePath", () => {
  it("accepts ordinary paths with queries", () => {
    expect(isSafePath("/")).toBe(true);
    expect(isSafePath("/portal/login?mt=A1&next=%2Fportal")).toBe(true);
    expect(isSafePath("/@evil.com")).toBe(true);
    expect(isSafePath("/%2F%2Fevil.com")).toBe(true);
  });
  it("rejects non-strings", () => {
    expect(isSafePath(undefined)).toBe(false);
    expect(isSafePath(5)).toBe(false);
  });
});

describe("redirectTargetFor", () => {
  beforeEach(() => {
    process.env.PORTAL_BASE_URL = PORTAL;
  });

  it("keeps the path and the whole query string intact, mt= codes included", () => {
    const url = "/portal/login?mt=AB12CD34EF56&next=%2Fportal%2Fquote%2FTOK&x=a%20b";
    expect(redirectTargetFor("portal", url)).toBe(`${PORTAL}${url}`);
    expect(redirectTargetFor("staff", "/clients?id=1")).toBe("https://travana.app/clients?id=1");
  });

  it.each(["//evil.com", "//evil.com/portal", "/\\evil.com", "/\\\\evil.com", "https://evil.com", "evil.com", "", "/portal\r\nSet-Cookie: a=b", "/a\nb", "/a\u0000b"])(
    "answers null for %j",
    (url) => {
      expect(redirectTargetFor("portal", url)).toBeNull();
      expect(redirectTargetFor("staff", url)).toBeNull();
    },
  );

  it("treats /@evil.com and an encoded double slash as plain paths on the same origin", () => {
    for (const url of ["/@evil.com", "/%2F%2Fevil.com"]) {
      const target = redirectTargetFor("portal", url);
      expect(target).toBe(`${PORTAL}${url}`);
      expect(new URL(target as string).origin).toBe(PORTAL);
    }
  });

  it("refuses very long URLs and accepts one just inside the limit", () => {
    expect(redirectTargetFor("portal", `/${"a".repeat(9000)}`)).toBeNull();
    expect(redirectTargetFor("portal", `/${"a".repeat(8000)}`)).not.toBeNull();
  });

  it("is null when the target host is not configured", () => {
    delete process.env.PORTAL_BASE_URL;
    expect(redirectTargetFor("portal", "/portal")).toBeNull();
    delete process.env.BASE_URL;
    expect(redirectTargetFor("staff", "/portal")).toBeNull();
  });
});

describe("hostsForPage and getStaffOrigin", () => {
  it("gives empty origins when there is one host", () => {
    expect(hostsForPage(on("travana.app"))).toEqual({ portal: "", staff: "", kind: "single" });
  });
  it("gives both origins (and the kind of this request) with two hosts", () => {
    process.env.PORTAL_BASE_URL = PORTAL;
    expect(getStaffOrigin()).toBe("https://travana.app");
    expect(hostsForPage(on("travana.app"))).toEqual({ portal: PORTAL, staff: "https://travana.app", kind: "staff" });
    expect(hostsForPage(on("portal.travana.app"))).toEqual({ portal: PORTAL, staff: "https://travana.app", kind: "portal" });
  });
});
