import { describe, expect, it } from "vitest";
import { isPreviewSearch, shareableQuoteUrl } from "./preview-search";

describe("isPreviewSearch", () => {
  it("is true only for preview=1", () => {
    expect(isPreviewSearch("?preview=1")).toBe(true);
    expect(isPreviewSearch("?a=b&preview=1")).toBe(true);
    expect(isPreviewSearch("?preview=0")).toBe(false);
    expect(isPreviewSearch("")).toBe(false);
  });
});

describe("shareableQuoteUrl", () => {
  it("strips preview, keeps other parameters, drops the hash", () => {
    expect(shareableQuoteUrl("https://app.example.com/view-quote/ABC234?preview=1")).toBe("https://app.example.com/view-quote/ABC234");
    expect(shareableQuoteUrl("https://app.example.com/view-quote/ABC234?utm=x&preview=1#top")).toBe("https://app.example.com/view-quote/ABC234?utm=x");
    expect(shareableQuoteUrl("https://app.example.com/view-quote/ABC234")).toBe("https://app.example.com/view-quote/ABC234");
  });
});
