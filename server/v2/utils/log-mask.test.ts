import { describe, it, expect } from "vitest";
import { isQuoteTokenPath, maskQuoteTokenPath } from "./log-mask";

describe("maskQuoteTokenPath", () => {
  it("masks the token on the public API, the page and the staff preview, keeping the rest of the path", () => {
    expect(maskQuoteTokenPath("/api/public/quote/ABC234")).toBe("/api/public/quote/:token");
    expect(maskQuoteTokenPath("/api/public/quote/ABC234/view")).toBe("/api/public/quote/:token/view");
    expect(maskQuoteTokenPath("/view-quote/ABC234")).toBe("/view-quote/:token");
    expect(maskQuoteTokenPath("/api/v2/quotes/preview/ABC234")).toBe("/api/v2/quotes/preview/:token");
  });

  it("leaves every other path alone", () => {
    expect(maskQuoteTokenPath("/api/v2/quotes/123")).toBe("/api/v2/quotes/123");
    expect(maskQuoteTokenPath("/api/portal/quotes/ABC234")).toBe("/api/portal/quotes/ABC234");
  });

  it("flags the paths whose response bodies must not be logged", () => {
    expect(isQuoteTokenPath("/api/public/quote/ABC234")).toBe(true);
    expect(isQuoteTokenPath("/api/v2/quotes/preview/ABC234")).toBe(true);
    expect(isQuoteTokenPath("/api/v2/quotes/123")).toBe(false);
  });
});
