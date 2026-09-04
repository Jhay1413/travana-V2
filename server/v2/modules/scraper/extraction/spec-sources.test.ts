import { describe, expect, it } from "vitest";
import { specSchema } from "./extraction-ai.service";
import { runExtractionSpec } from "./extraction.interpreter";
import type { ExtractionSpec, FieldSource } from "./extraction.types";

// The validator and the interpreter must agree on which field sources exist.
// They drifted: FieldSource and the interpreter both had "headings", but the
// validator's enum did not, so `normaliseFrom` rewrote every heading rule to
// "text". The AI is told to read quote_title from the headings BY POSITION, so
// the positional regex then counted lines of the page BODY — Carnival's title
// came out "IMPORTANT NOTICE", the second line of a site banner.
const ALL_SOURCES: FieldSource[] = ["text", "title", "url", "images", "headings"];

describe("field sources: validator vs interpreter", () => {
  it.each(ALL_SOURCES)("accepts a rule whose source is %s", (from) => {
    const parsed = specSchema.safeParse({
      version: 1,
      fields: { quote_title: { from, regex: "^([^\\n]+)", group: 1 } },
    });
    expect(parsed.success).toBe(true);
    // The value must survive unchanged — normalising it to "text" is the bug.
    expect(parsed.success && parsed.data.fields.quote_title.from).toBe(from);
  });

  it("still normalises a source the AI invented", () => {
    const parsed = specSchema.safeParse({
      version: 1,
      fields: { sales_price: { from: "apiJson", jsonPath: "offers[0].price" } },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.fields.sales_price.from).toBe("text");
  });

  it("reads the headline from the headings, not the page body", () => {
    // A validated heading rule, applied end to end. The body's second line is a
    // site banner; the second HEADING is the deal.
    const spec = specSchema.parse({
      version: 1,
      fields: { quote_title: { from: "headings", regex: "^[^\\n]*\\n([^\\n]+)", group: 1 } },
    }) as unknown as ExtractionSpec;
    const q = runExtractionSpec(spec, {
      title: "Carnival - Review Panel",
      text: "Skip to main content\nIMPORTANT NOTICE\nGet important information on a privacy event.",
      url: "https://www.carnival.com/booking/review?sailDate=07022027",
      headings: ["Cruise Summary", "3-Day The Bahamas from Miami, FL", "Frequently Asked Questions"],
    }, "x");
    expect(q.quote_title).toBe("3-Day The Bahamas from Miami, FL");
    expect(q.quote_title).not.toBe("IMPORTANT NOTICE");
  });
});
