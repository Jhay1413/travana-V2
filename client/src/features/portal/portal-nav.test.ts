import { describe, it, expect } from "vitest";
import { PORTAL_TABS, TRIPS_SEGMENTS, activeTabForPath, portalRedirectTarget, tripsSegmentForPath } from "./portal-nav";

describe("tabs", () => {
  it("has exactly the five tabs in order", () => {
    expect(PORTAL_TABS.map((t) => t.key)).toEqual(["home", "trips", "deals", "messages", "account"]);
    expect(PORTAL_TABS.map((t) => t.label)).toEqual(["Home", "Trips", "Deals", "Messages", "Account"]);
  });
});

describe("activeTabForPath", () => {
  it("maps each tab's own path", () => {
    for (const t of PORTAL_TABS) expect(activeTabForPath(t.path)).toBe(t.key);
  });
  it("tolerates a trailing slash, query and hash", () => {
    expect(activeTabForPath("/portal/")).toBe("home");
    expect(activeTabForPath("/portal/deals?country=Spain")).toBe("deals");
    expect(activeTabForPath("/portal/messages#end")).toBe("messages");
  });
  it("puts quotes, bookings, trips segments and a quote link under Trips", () => {
    for (const p of ["/portal/trips/quotes", "/portal/trips/bookings", "/portal/quotes", "/portal/bookings", "/portal/quote/abc123", "/portal/booking/b1"]) {
      expect(activeTabForPath(p)).toBe("trips");
    }
  });
  it("puts referrals and interests under Account", () => {
    expect(activeTabForPath("/portal/referrals")).toBe("account");
    expect(activeTabForPath("/portal/tags")).toBe("account");
  });
  it("has no tab for the login page or unknown paths", () => {
    expect(activeTabForPath("/portal/login")).toBeNull();
    expect(activeTabForPath("/portal/nope")).toBeNull();
  });
});

describe("tripsSegmentForPath", () => {
  it("bookings only for the bookings paths, otherwise quotes", () => {
    expect(tripsSegmentForPath("/portal/trips/bookings")).toBe("bookings");
    expect(tripsSegmentForPath("/portal/bookings")).toBe("bookings");
    expect(tripsSegmentForPath("/portal/trips/quotes")).toBe("quotes");
    expect(tripsSegmentForPath("/portal/trips")).toBe("quotes");
    expect(tripsSegmentForPath("/portal/quote/abc")).toBe("quotes");
  });
  it("segment paths are the redirect targets", () => {
    expect(TRIPS_SEGMENTS.map((s) => s.path)).toEqual(["/portal/trips/quotes", "/portal/trips/bookings"]);
  });
});

describe("portalRedirectTarget", () => {
  it("/portal/quotes goes to Trips / Quotes", () => {
    expect(portalRedirectTarget("/portal/quotes")).toBe("/portal/trips/quotes");
  });
  it("/portal/bookings goes to Trips / Bookings", () => {
    expect(portalRedirectTarget("/portal/bookings")).toBe("/portal/trips/bookings");
  });
  it("bare /portal/trips opens Quotes", () => {
    expect(portalRedirectTarget("/portal/trips")).toBe("/portal/trips/quotes");
  });
  it("keeps the query string and hash, and tolerates a trailing slash", () => {
    expect(portalRedirectTarget("/portal/quotes/", "?a=1", "#x")).toBe("/portal/trips/quotes?a=1#x");
  });
  it("needs no redirect for the new paths, the quote link, or anything else", () => {
    for (const p of ["/portal", "/portal/trips/quotes", "/portal/trips/bookings", "/portal/quote/abc", "/portal/account", "/portal/login"]) {
      expect(portalRedirectTarget(p)).toBeNull();
    }
  });
  it("every redirect lands on a path that needs none (no loops)", () => {
    for (const p of ["/portal/quotes", "/portal/bookings", "/portal/trips"]) {
      const target = portalRedirectTarget(p) as string;
      expect(portalRedirectTarget(target)).toBeNull();
    }
  });
});

import { interestsRedirectTarget, portalNextTarget, withoutParams } from "./portal-nav";

describe("portalNextTarget", () => {
  it("honours only same-site portal paths", () => {
    expect(portalNextTarget("?next=%2Fportal%2Faccount%3Fchange-pin%3D1")).toBe("/portal/account?change-pin=1");
    expect(portalNextTarget("?next=https://evil.example")).toBe("/portal");
    expect(portalNextTarget("?next=//evil.example")).toBe("/portal");
    expect(portalNextTarget("")).toBe("/portal");
  });
});

describe("withoutParams", () => {
  it("drops the named parameters and keeps the rest", () => {
    expect(withoutParams("?mt=abc&next=%2Fportal&org=sunny", ["mt"])).toBe("?next=%2Fportal&org=sunny");
    expect(withoutParams("?token=x", ["token", "mt"])).toBe("");
    expect(withoutParams("", ["mt"])).toBe("");
  });
});

describe("interestsRedirectTarget", () => {
  it("keeps a pending change-pin through the interests step", () => {
    const target = interestsRedirectTarget("/portal/account", "?change-pin=1");
    expect(target).toBe("/portal/tags?next=%2Fportal%2Faccount%3Fchange-pin%3D1");
    expect(portalNextTarget(target.slice(target.indexOf("?")))).toBe("/portal/account?change-pin=1");
  });
  it("is the plain interests page otherwise", () => {
    expect(interestsRedirectTarget("/portal/deals", "")).toBe("/portal/tags");
    expect(interestsRedirectTarget("/portal/account", "?change-pin=0")).toBe("/portal/tags");
  });
});
