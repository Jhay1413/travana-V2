import { describe, expect, it, vi } from "vitest";
import { parseCapture } from "./use-page-capture-import";

// parseCapture rebuilds the payload from a WHITELIST, so any field the
// bookmarklet learns to send has to be added here too — otherwise it is dropped
// silently between the clipboard and the request, which is exactly how the
// booking JSON went missing while every other layer worked, and how a
// field-picker payload (pickerVersion/packageType/picked) pasted into the
// normal "Capture from supplier page" dialog was silently discarded: picks
// stripped, an ordinary import, a success toast, and no rule ever written.
describe("parseCapture", () => {
  const pickedField = {
    field: "sales_price",
    value: "£914.24",
    textIndex: 20,
    lineIndex: 1,
    linesBefore: ["Plaza Prague Hotel"],
    linesAfter: [],
    occurrenceIndex: 0,
    occurrenceCount: 1,
    tag: "SPAN",
    ancestorTags: ["DIV"],
    siblingIndex: 0,
  };

  const capture = {
    url: "https://retailagents.tui.co.uk/retail/bookaccommodation?productCode=951299",
    title: "TUI Holidays",
    text: "Plaza Prague Hotel\nTotal Price £914.24",
    images: ["https://cdn.images.tui/tui-images/aaa.jpg", 42],
    flightsText: "Your flights",
    apiJson: { packageData: { itinerary: { outbounds: [{ departureAirportCode: "STN" }] } } },
    deepText: "Itinerary\nDay 1\nSouthampton, England",
    pickerVersion: 14,
    packageType: "package-holiday",
    picked: [pickedField],
  };

  it("preserves the operator's booking JSON", () => {
    const parsed = parseCapture(JSON.stringify(capture));
    expect(parsed.apiJson).toEqual(capture.apiJson);
  });

  it("preserves deepText — the full DOM text including collapsed drawers", () => {
    const parsed = parseCapture(JSON.stringify(capture));
    expect(parsed.deepText).toBe(capture.deepText);
  });

  it("leaves deepText undefined when the page carried none", () => {
    const { deepText, ...withoutDeepText } = capture;
    expect(parseCapture(JSON.stringify({ ...withoutDeepText, deepText: "" })).deepText).toBeUndefined();
    expect(parseCapture(JSON.stringify(withoutDeepText)).deepText).toBeUndefined();
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

  // The field-picker fields: pickerVersion, packageType and picked. These are
  // the exact three keys the whitelist omitted, which is why a picker payload
  // pasted into this dialog produced an ordinary import with the picks gone.
  it("preserves the field-picker's picked array", () => {
    const parsed = parseCapture(JSON.stringify(capture));
    expect(parsed.picked).toEqual(capture.picked);
  });

  it("preserves pickerVersion and packageType", () => {
    const parsed = parseCapture(JSON.stringify(capture));
    expect(parsed.pickerVersion).toBe(14);
    expect(parsed.packageType).toBe("package-holiday");
  });

  it("leaves picked/pickerVersion/packageType undefined on an ordinary capture", () => {
    const { picked, pickerVersion, packageType, ...ordinary } = capture;
    const parsed = parseCapture(JSON.stringify(ordinary));
    expect(parsed.picked).toBeUndefined();
    expect(parsed.pickerVersion).toBeUndefined();
    expect(parsed.packageType).toBeUndefined();
  });

  it("rejects an unrecognised packageType rather than passing it through", () => {
    const parsed = parseCapture(JSON.stringify({ ...capture, packageType: "villa" }));
    expect(parsed.packageType).toBeUndefined();
  });

  it("rejects text that isn't a capture", () => {
    expect(() => parseCapture("just some copied page text")).toThrow(/doesn't look like a capture/i);
    expect(() => parseCapture(JSON.stringify({ text: "no url" }))).toThrow(/missing its url\/text/i);
  });
});

// pageCaptureImportApi.import: the server-side counterpart to the whitelist
// bug above. Even with parseCapture fixed, a regression in the validator or
// service could still strip `picked` between here and the database — so this
// guards the OTHER direction: a request that sent picks must get a `picks`
// key back, or the client refuses to treat it as a quiet success.
const post = vi.fn();
vi.mock("@/api/client/axios-client", () => ({
  default: { post: (...args: unknown[]) => post(...args) },
}));

const { pageCaptureImportApi } = await import("./use-page-capture-import");

describe("pageCaptureImportApi.import", () => {
  const baseInput = {
    url: "https://retailagents.tui.co.uk/retail/bookaccommodation?productCode=951299",
    text: "Plaza Prague Hotel\nTotal Price £914.24",
  };

  it("throws when the request carried picks but the response has no picks key", async () => {
    post.mockResolvedValueOnce({
      data: { message: "Imported", data: { sales_price: 914.24 } },
    });
    await expect(
      pageCaptureImportApi.import({
        ...baseInput,
        picked: [
          {
            field: "sales_price",
            value: "£914.24",
            textIndex: 20,
            lineIndex: 1,
            linesBefore: [],
            linesAfter: [],
            occurrenceIndex: 0,
            occurrenceCount: 1,
            tag: "SPAN",
            ancestorTags: [],
            siblingIndex: 0,
          },
        ],
      }),
    ).rejects.toThrow(/didn't confirm applying them/i);
  });

  it("returns picks when the response confirms them", async () => {
    post.mockResolvedValueOnce({
      data: {
        message: "Imported",
        data: {
          sales_price: 914.24,
          picks: { supplierKey: "tui", applied: [], problems: [], preserved: [], specNeedsReview: true },
        },
      },
    });
    const result = await pageCaptureImportApi.import({
      ...baseInput,
      picked: [
        {
          field: "sales_price",
          value: "£914.24",
          textIndex: 20,
          lineIndex: 1,
          linesBefore: [],
          linesAfter: [],
          occurrenceIndex: 0,
          occurrenceCount: 1,
          tag: "SPAN",
          ancestorTags: [],
          siblingIndex: 0,
        },
      ],
    });
    expect(result.picks?.supplierKey).toBe("tui");
    expect(result.quote.picks).toBeUndefined();
  });

  it("doesn't require a picks key on an ordinary import", async () => {
    post.mockResolvedValueOnce({ data: { message: "Imported", data: { sales_price: 914.24 } } });
    const result = await pageCaptureImportApi.import(baseInput);
    expect(result.picks).toBeUndefined();
    expect(result.quote.sales_price).toBe(914.24);
  });
});
