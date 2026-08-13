import { describe, expect, it } from "vitest";
import { runExtractionSpec } from "./extraction.interpreter";
import type { ExtractionSpec } from "./extraction.types";

// A spec routinely carries BOTH a constant and a field rule for the same key:
// the AI is told to declare tour_operator/currency as constants and, separately,
// to try to extract every common field. When such a rule matched nothing it
// returned '' and overwrote the constant — so a page whose wording didn't fit
// the rule lost a value the spec stated outright. For tour_operator that left
// the quote form's operator dropdown empty, because the client maps the NAME to
// an id and an empty name resolves to no id at all.

const PAGE = "https://trade.example.com/beach/spain/costa-dorada/salou/a-hotel";
const run = (spec: Partial<ExtractionSpec>, text: string) =>
  runExtractionSpec(
    { version: 1, fields: {}, ...spec } as ExtractionSpec,
    { title: "A Hotel | Portal", text, url: PAGE },
    "2026-08-13T00:00:00Z",
  );

describe("a constant and a field rule for the same key", () => {
  const spec = {
    constants: { tour_operator: "Easyjet", currency: "GBP" },
    fields: {
      // Overfitted to one deal's wording — matches nothing on most pages.
      tour_operator: { from: "text", regex: "Operated by ([A-Za-z2 ]+) Holidays", group: 1 },
    },
  } as unknown as Partial<ExtractionSpec>;

  it("keeps the constant when the rule matches nothing", () => {
    expect(run(spec, "A hotel page with no operator wording\n" + "x".repeat(300)).tour_operator).toBe("Easyjet");
  });

  it("still lets a rule that DOES match win", () => {
    const out = run(spec, "Operated by Jet2 Holidays\n" + "x".repeat(300));
    expect(out.tour_operator).toBe("Jet2");
  });

  it("leaves a constant with no rule alone", () => {
    expect(run(spec, "x".repeat(300)).currency).toBe("GBP");
  });
});

describe("keys with no constant behind them", () => {
  it("still resolve to empty when their rule misses", () => {
    const out = run(
      { fields: { accommodation: { from: "text", regex: "Hotel: ([A-Za-z ]+)", group: 1 } } },
      "nothing matching here\n" + "x".repeat(300),
    );
    expect(out.accommodation).toBe("");
  });

  // A rule's own `fallback` is an explicit value, not an empty match, so it must
  // still apply — transfer_type relies on this to report "None".
  it("still apply a rule's explicit fallback", () => {
    const out = run(
      {
        constants: { transfer_type: "Shared Transfer" },
        fields: { transfer_type: { from: "text", regex: "(Private transfer)", group: 1, fallback: "None" } },
      },
      "no transfer wording at all\n" + "x".repeat(300),
    );
    expect(out.transfer_type).toBe("None");
  });
});
