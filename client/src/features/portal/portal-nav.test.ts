import { describe, it, expect } from "vitest";
import { PORTAL_TABS, activeTabForPath, interestsRedirectTarget, menuKeyForPath, portalNextTarget, portalRedirectTarget, portalTabs, withoutParams } from "./portal-nav";

describe("portal tabs", () => {
  it("are five: Home, Quotes, Bookings, Message and the agent", () => {
    expect(PORTAL_TABS.map((t) => t.key)).toEqual(["home", "quotes", "bookings", "messages", "agent"]);
    expect(PORTAL_TABS.map((t) => t.label)).toEqual(["Home", "Quotes", "Bookings", "Message", "Agent"]);
    expect(PORTAL_TABS.map((t) => t.path)).toEqual(["/portal", "/portal/quotes", "/portal/bookings", "/portal/messages", null]);
  });
  it("label the fifth tab with the agent's first name, else Agent, and it opens no page", () => {
    expect(portalTabs("James")[4].label).toBe("James");
    expect(portalTabs("your agent")[4].label).toBe("Agent");
    expect(portalTabs("")[4].label).toBe("Agent");
    expect(portalTabs("James")[4].path).toBeNull();
    expect(portalTabs("James")[3].label).toBe("Message");
  });
});

describe("activeTabForPath", () => {
  it("marks each tab on its own path", () => {
    for (const t of PORTAL_TABS) if (t.path) expect(activeTabForPath(t.path)).toBe(t.key);
  });
  it("tolerates a trailing slash, a query and a hash", () => {
    expect(activeTabForPath("/portal/")).toBe("home");
    expect(activeTabForPath("/portal/messages#end")).toBe("messages");
    expect(activeTabForPath("/portal/quotes?x=1")).toBe("quotes");
  });
  it("puts a quote under Quotes and a booking under Bookings", () => {
    expect(activeTabForPath("/portal/quote/abc123")).toBe("quotes");
    expect(activeTabForPath("/portal/booking/b1")).toBe("bookings");
  });
  it("has no tab for deals, rewards, interests, account, login or unknown paths", () => {
    for (const p of ["/portal/deals", "/portal/referrals", "/portal/tags", "/portal/account", "/portal/login", "/portal/nope"]) {
      expect(activeTabForPath(p)).toBeNull();
    }
  });
});

describe("menuKeyForPath", () => {
  it("marks the menu row for tabbed and tab-less pages", () => {
    expect(menuKeyForPath("/portal")).toBe("home");
    expect(menuKeyForPath("/portal/quote/abc")).toBe("quotes");
    expect(menuKeyForPath("/portal/booking/b1")).toBe("bookings");
    expect(menuKeyForPath("/portal/deals")).toBe("deals");
    expect(menuKeyForPath("/portal/referrals")).toBe("rewards");
    expect(menuKeyForPath("/portal/tags")).toBe("interests");
    expect(menuKeyForPath("/portal/account")).toBe("account");
    expect(menuKeyForPath("/portal/messages")).toBe("messages");
  });
});

describe("portalRedirectTarget", () => {
  it("sends the old Trips paths to the separate screens", () => {
    expect(portalRedirectTarget("/portal/trips")).toBe("/portal/quotes");
    expect(portalRedirectTarget("/portal/trips/quotes")).toBe("/portal/quotes");
    expect(portalRedirectTarget("/portal/trips/bookings")).toBe("/portal/bookings");
  });
  it("keeps the query string and hash, and tolerates a trailing slash", () => {
    expect(portalRedirectTarget("/portal/trips/quotes/", "?a=1", "#x")).toBe("/portal/quotes?a=1#x");
  });
  it("needs no redirect for the current paths, the quote link, or anything else", () => {
    for (const p of ["/portal", "/portal/quotes", "/portal/bookings", "/portal/quote/abc", "/portal/booking/b1", "/portal/account", "/portal/login"]) {
      expect(portalRedirectTarget(p)).toBeNull();
    }
  });
  it("every redirect lands on a path that needs none (no loops)", () => {
    for (const p of ["/portal/trips", "/portal/trips/quotes", "/portal/trips/bookings"]) {
      const target = portalRedirectTarget(p) as string;
      expect(portalRedirectTarget(target)).toBeNull();
    }
  });
});

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
