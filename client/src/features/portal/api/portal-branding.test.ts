import { describe, it, expect } from "vitest";
import {
  NEUTRAL_BRANDING,
  PORTAL_BRANDING_CACHE_KEY,
  displayName,
  isNeutralBranding,
  parseBranding,
  readBrandingCache,
  resolvePortalSlug,
  writeBrandingCache,
  type BrandingStorage,
} from "./portal-branding";

function memoryStorage(initial: Record<string, string> = {}): BrandingStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const sunny = { ...NEUTRAL_BRANDING, name: "Sunny Travel", brandColor: "#1a5fb4", logoUrl: "https://x/logo.png" };

describe("parseBranding", () => {
  it("keeps the signed-in slug", () => {
    expect(parseBranding({ name: "A", slug: "a-b" }).slug).toBe("a-b");
  });
  it("keeps only known string fields", () => {
    const out = parseBranding({ name: " Sunny ", brandColor: "#123456", plan: "enterprise", logoUrl: 5, atol: "A1", agentName: "Jo", extra: { a: 1 } });
    expect(out).toEqual({ ...NEUTRAL_BRANDING, name: "Sunny", brandColor: "#123456", atol: "A1", agentName: "Jo" });
    expect("plan" in out).toBe(false);
  });
  it("returns the neutral default for non-objects", () => {
    for (const bad of [null, undefined, "x", 4, [1]]) expect(parseBranding(bad)).toEqual(NEUTRAL_BRANDING);
  });
  it("does not add atol, abta or agentName when absent", () => {
    const out = parseBranding({ name: "A" });
    expect("atol" in out || "abta" in out || "agentName" in out).toBe(false);
  });
});

describe("displayName", () => {
  it("uses the agency name, else a neutral label, never a fixed company", () => {
    expect(displayName(sunny)).toBe("Sunny Travel");
    expect(displayName(NEUTRAL_BRANDING)).toBe("Your travel agent");
    expect(displayName(NEUTRAL_BRANDING)).not.toMatch(/travana|tina/i);
  });
});

describe("branding cache", () => {
  it("round-trips for the same slug", () => {
    const s = memoryStorage();
    writeBrandingCache(s, "sunny", sunny);
    expect(readBrandingCache(s, "sunny")).toEqual(sunny);
  });

  it("never stores the agent's name", () => {
    const s = memoryStorage();
    writeBrandingCache(s, null, { ...sunny, agentName: "Jo" });
    expect(s.data[PORTAL_BRANDING_CACHE_KEY]).not.toContain("Jo");
    expect(readBrandingCache(s, null)?.agentName).toBeUndefined();
  });

  it("does not show one agency's cache to a visit that names another", () => {
    const s = memoryStorage();
    writeBrandingCache(s, "sunny", sunny);
    expect(readBrandingCache(s, "other")).toBeNull();
  });

  it("a cache saved from a signed-in session is filed under the agency slug the server reported", () => {
    const s = memoryStorage();
    writeBrandingCache(s, null, { ...sunny, slug: "sunny" });
    expect(readBrandingCache(s, "sunny")).toEqual(sunny);
    expect(readBrandingCache(s, "other")).toBeNull();
    expect(readBrandingCache(s, null)).toEqual(sunny);
  });

  it("a cache with no slug at all is never shown to a visit that names an agency", () => {
    const s = memoryStorage();
    writeBrandingCache(s, null, sunny);
    expect(readBrandingCache(s, "sunny")).toBeNull();
    expect(readBrandingCache(s, null)).toEqual(sunny);
  });

  it("shows the last cache to a visit that names no agency", () => {
    const s = memoryStorage();
    writeBrandingCache(s, "sunny", sunny);
    expect(readBrandingCache(s, null)).toEqual(sunny);
  });

  it("does not cache an empty response over a good one", () => {
    const s = memoryStorage();
    writeBrandingCache(s, "sunny", sunny);
    writeBrandingCache(s, "sunny", NEUTRAL_BRANDING);
    expect(readBrandingCache(s, "sunny")).toEqual(sunny);
  });

  it("survives corrupt or hostile stored values", () => {
    for (const raw of ["{", "null", "[]", '{"branding":"x"}', '{"slug":1}']) {
      expect(readBrandingCache(memoryStorage({ [PORTAL_BRANDING_CACHE_KEY]: raw }), "sunny")).toBeNull();
    }
  });

  it("a storage that throws never breaks the page", () => {
    const broken: BrandingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(() => writeBrandingCache(broken, null, sunny)).not.toThrow();
    expect(readBrandingCache(broken, null)).toBeNull();
  });

  it("isNeutralBranding", () => {
    expect(isNeutralBranding(NEUTRAL_BRANDING)).toBe(true);
    expect(isNeutralBranding(sunny)).toBe(false);
  });
});

describe("resolvePortalSlug", () => {
  it("a valid ?org= wins over the remembered slug", () => {
    expect(resolvePortalSlug("?org=Sunny-Travel", "other")).toBe("sunny-travel");
  });
  it("falls back to the remembered slug", () => {
    expect(resolvePortalSlug("", "sunny")).toBe("sunny");
    expect(resolvePortalSlug("?foo=1", "sunny")).toBe("sunny");
  });
  it("ignores a junk ?org= and a junk remembered value", () => {
    expect(resolvePortalSlug("?org=../x", "sunny")).toBe("sunny");
    expect(resolvePortalSlug("?org=%00", "bad slug")).toBeNull();
    expect(resolvePortalSlug("", null)).toBeNull();
  });
});
