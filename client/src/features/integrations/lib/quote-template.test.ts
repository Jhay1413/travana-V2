import { describe, expect, it } from "vitest";
import { isSavedOnOtherChannel, isSavedQuoteTemplate } from "./quote-template";
import type { QuoteTemplateSettings } from "../types";

const saved: QuoteTemplateSettings = { templateName: "quote_link", templateLanguage: "en_GB", channelId: "c1", variables: {} };
const empty: QuoteTemplateSettings = { templateName: null, templateLanguage: null, channelId: null, variables: {} };

describe("isSavedQuoteTemplate", () => {
  it("matches name and language", () => {
    expect(isSavedQuoteTemplate({ name: "quote_link", language: "en_GB" }, saved)).toBe(true);
    expect(isSavedQuoteTemplate({ name: "quote_link", language: "en_US" }, saved)).toBe(false);
    expect(isSavedQuoteTemplate({ name: "other", language: "en_GB" }, saved)).toBe(false);
  });
  it("is false with no saved template", () => {
    expect(isSavedQuoteTemplate({ name: "a", language: "en" }, empty)).toBe(false);
    expect(isSavedQuoteTemplate({ name: "a", language: "en" }, undefined)).toBe(false);
  });
});

describe("isSavedOnOtherChannel", () => {
  it("detects a different channel", () => {
    expect(isSavedOnOtherChannel(saved, "c2")).toBe(true);
    expect(isSavedOnOtherChannel(saved, "c1")).toBe(false);
  });
  it("is false when nothing is saved", () => {
    expect(isSavedOnOtherChannel(empty, "c2")).toBe(false);
    expect(isSavedOnOtherChannel(undefined, "c2")).toBe(false);
  });
});
