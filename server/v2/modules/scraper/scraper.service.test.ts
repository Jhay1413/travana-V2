import { describe, expect, it } from "vitest";
import { supplierIdentityFromUrl } from "./scraper.service";

// Every supplier auto-created from a captured page takes its identity from here,
// so a wrong split means a badly-named supplier and — worse — a deepLink that
// matches the wrong sites.
describe("supplierIdentityFromUrl", () => {
  it("names a supplier after the registrable domain's main label", () => {
    expect(supplierIdentityFromUrl("https://example.com/deal/123")).toEqual({
      key: "example",
      name: "Example",
      hostIncludes: "example.com",
    });
  });

  it("ignores www and portal subdomains", () => {
    expect(supplierIdentityFromUrl("https://www.easyjet.com/en/holidays/x?y=1").key).toBe("easyjet");
    expect(supplierIdentityFromUrl("https://trade.jet2holidays.com/beach/spain/x").key).toBe("jet2holidays");
    expect(supplierIdentityFromUrl("https://booking.tui.co.uk/x").key).toBe("tui");
  });

  it("handles compound public suffixes", () => {
    expect(supplierIdentityFromUrl("https://www.hoseasons.co.uk/agents/x")).toEqual({
      key: "hoseasons",
      name: "Hoseasons",
      hostIncludes: "hoseasons.co.uk",
    });
    expect(supplierIdentityFromUrl("https://www.travelrepublic.com.au/x").hostIncludes).toBe("travelrepublic.com.au");
  });

  it("matches the whole portal, not just the captured subdomain", () => {
    // hostIncludes is a substring test on the hostname, so a deal captured from
    // trade.* must still resolve when a later one comes from www.*.
    const { hostIncludes } = supplierIdentityFromUrl("https://trade.jet2holidays.com/x");
    expect("www.jet2holidays.com".includes(hostIncludes)).toBe(true);
    expect("trade.jet2holidays.com".includes(hostIncludes)).toBe(true);
    expect("jet2holidays.com.evil.test".includes(hostIncludes)).toBe(true); // known: substring match
  });

  it("keeps hyphenated names and rejects an unusable URL", () => {
    expect(supplierIdentityFromUrl("https://deals.some-operator.net/a").key).toBe("some-operator");
    expect(() => supplierIdentityFromUrl("not a url")).toThrow();
  });
});
