import { describe, expect, it } from "vitest";
import { runExtractionSpec } from "./extraction.interpreter";
import type { ExtractionSpec } from "./extraction.types";

// The quote's title was never populated by the scraper import path: only the
// cruise and generic-fallback importers set it, so every scraped quote arrived
// untitled. The headline is always an h1/h2, but once it is inside body
// innerText it is one line among thousands with nothing to anchor a regex to —
// hence the captured `headings` list and `from: "headings"`.

const URL = "https://trade.example.com/beach/spain/costa-dorada/salou/a-hotel";
const TEXT = "x".repeat(300);

const run = (spec: Partial<ExtractionSpec>, headings?: string[]) =>
  runExtractionSpec(
    { version: 1, fields: {}, ...spec } as ExtractionSpec,
    { title: "A Hotel - Salou hotels | Portal", text: TEXT, url: URL, headings },
    "2026-08-11T00:00:00Z",
  );

describe("quote_title", () => {
  it("falls back to the hotel name when the spec has no rule", () => {
    const q = run({ fields: { accommodation: { from: "title", regex: "^([^-|]+)", group: 1 } } });
    expect(q.quote_title).toBe("A Hotel");
  });

  it("is never blank when a hotel name was found — the bug this fixes", () => {
    const q = run({ fields: { accommodation: { from: "title", regex: "^([^-|]+)", group: 1 } } }, ["Something else"]);
    expect(q.quote_title).toBeTruthy();
  });

  // Jet2/TUI put the hotel name in the heading; easyJet puts a marketing
  // strapline there. Both are just "whichever line of the headings list".
  it("takes the first heading when the rule asks for it", () => {
    const q = run(
      { fields: { quote_title: { from: "headings", regex: "^([^\\n]+)", group: 1 } } },
      ["Sol Costa Daurada", "Your holiday to Costa Dorada", "Overview"],
    );
    expect(q.quote_title).toBe("Sol Costa Daurada");
  });

  it("takes the second heading when the headline sits below the hotel name", () => {
    const q = run(
      { fields: { quote_title: { from: "headings", regex: "^[^\\n]*\\n([^\\n]+)", group: 1 } } },
      ["Sol Costa Daurada", "Five-star escape nestled near the Mediterranean Sea", "Facilities"],
    );
    expect(q.quote_title).toBe("Five-star escape nestled near the Mediterranean Sea");
  });

  it("prefers the spec rule over the hotel-name fallback", () => {
    const q = run(
      {
        fields: {
          accommodation: { from: "title", regex: "^([^-|]+)", group: 1 },
          quote_title: { from: "headings", regex: "^([^\\n]+)", group: 1 },
        },
      },
      ["Five-star escape nestled near the Mediterranean Sea"],
    );
    expect(q.quote_title).toBe("Five-star escape nestled near the Mediterranean Sea");
    expect(q.accommodation).toBe("A Hotel");
  });

  // A capture from a pre-v7 bookmarklet carries no headings at all. The rule
  // must miss quietly and leave the fallback to do its job, not blank the title.
  it("survives a capture with no headings", () => {
    const q = run({
      fields: {
        accommodation: { from: "title", regex: "^([^-|]+)", group: 1 },
        quote_title: { from: "headings", regex: "^([^\\n]+)", group: 1 },
      },
    });
    expect(q.quote_title).toBe("A Hotel");
  });
});
