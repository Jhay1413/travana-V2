import { describe, expect, it } from "vitest";
import { parseCapture } from "./use-page-capture-import";

// parseCapture rebuilds the payload from a WHITELIST, so any field the
// bookmarklet learns to send has to be added here too — otherwise it is dropped
// silently between the clipboard and the request, which is exactly how the
// booking JSON went missing while every other layer worked.
describe("parseCapture", () => {
  const capture = {
    url: "https://retailagents.tui.co.uk/retail/bookaccommodation?productCode=951299",
    title: "TUI Holidays",
    text: "Plaza Prague Hotel\nTotal Price £914.24",
    images: ["https://cdn.images.tui/tui-images/aaa.jpg", 42],
    flightsText: "Your flights",
    apiJson: { packageData: { itinerary: { outbounds: [{ departureAirportCode: "STN" }] } } },
  };

  it("preserves the operator's booking JSON", () => {
    const parsed = parseCapture(JSON.stringify(capture));
    expect(parsed.apiJson).toEqual(capture.apiJson);
  });

  it("passes through the rest of the capture, dropping non-string images", () => {
    const parsed = parseCapture(JSON.stringify(capture));
    expect(parsed.url).toBe(capture.url);
    expect(parsed.text).toBe(capture.text);
    expect(parsed.title).toBe("TUI Holidays");
    expect(parsed.images).toEqual(["https://cdn.images.tui/tui-images/aaa.jpg"]);
    expect(parsed.flightsText).toBe("Your flights");
  });

  it("leaves apiJson undefined when the page embedded none", () => {
    const { apiJson, ...withoutJson } = capture;
    expect(parseCapture(JSON.stringify({ ...withoutJson, apiJson: null })).apiJson).toBeUndefined();
    expect(parseCapture(JSON.stringify(withoutJson)).apiJson).toBeUndefined();
  });

  it("rejects text that isn't a capture", () => {
    expect(() => parseCapture("just some copied page text")).toThrow(/doesn't look like a capture/i);
    expect(() => parseCapture(JSON.stringify({ text: "no url" }))).toThrow(/missing its url\/text/i);
  });
});
