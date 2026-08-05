import { describe, expect, it } from "vitest";
import { runExtractionSpec } from "./extraction.interpreter";
import type { ExtractionSpec } from "./extraction.types";

// Regression: the AI-generated spec for a supplier can be overfitted to the one
// example deal it was generated from (board_basis regex literally "Half Board",
// hardcoded URL slugs). The interpreter's supplier-agnostic fallbacks must fill
// board basis / occupancy / nights when such a spec extracts nothing.

const JET2_URL =
  "https://trade.jet2holidays.com/beach/canary-islands/gran-canaria/puerto-rico/cala-nova?airport=5&date=27-08-2026&duration=7&occupancy=r2c9r2c10r2c8r2c9";

// Mirrors the overfitted rules found in the stored "jet" spec.
const OVERFITTED_SPEC: ExtractionSpec = {
  version: 1,
  constants: { tour_operator: "Jet2holidays", currency: "GBP" },
  fields: {
    accommodation: { from: "title", regex: "^([^|]+)", group: 1 },
    board_basis: { from: "text", regex: "Half Board", group: 0, map: { "Half Board": "Half Board" } },
    adults: { from: "text", regex: "(\\d+) Adults? for \\d+ nights", group: 1, transform: "number" },
    no_of_nights: { from: "text", regex: "\\d+ Adults? for (\\d+) nights", group: 1, transform: "number" },
    sales_price: { from: "text", regex: "£([\\d,]+)", group: 1, transform: "number" },
  },
} as ExtractionSpec;

const PAGE_TEXT = [
  "Cala Nova",
  "Puerto Rico, Gran Canaria",
  "Self Catering",
  "One Bedroom apartment",
  "£6,190 total price",
  "Coach transfers included",
].join("\n");

const CTX = { title: "Cala Nova | Jet2holidays", text: PAGE_TEXT, url: JET2_URL };

describe("runExtractionSpec — supplier-agnostic fallbacks", () => {
  it("recovers board basis from the canonical vocabulary when the spec rule misses", () => {
    const out = runExtractionSpec(OVERFITTED_SPEC, CTX, "2026-08-05T00:00:00Z");
    expect(out.board_basis).toBe("Self Catering");
  });

  it("recovers occupancy and nights from the deal URL", () => {
    const out = runExtractionSpec(OVERFITTED_SPEC, CTX, "2026-08-05T00:00:00Z");
    // occupancy=r2c9r2c10r2c8r2c9 → 4 rooms × 2 adults, 4 child-age tokens.
    expect(out.adults).toBe(8);
    expect(out.children).toBe(4);
    expect(out.no_of_nights).toBe(7); // duration=7
    expect(out.travel_date).toBe("2026-08-27"); // date=27-08-2026 (URL fallback)
  });

  it("prefers the spec's own extraction when it matches", () => {
    const text = `${PAGE_TEXT}\n2 Adults for 10 nights\nHalf Board`;
    const out = runExtractionSpec(OVERFITTED_SPEC, { ...CTX, text }, "2026-08-05T00:00:00Z");
    expect(out.adults).toBe(2);
    expect(out.no_of_nights).toBe(10);
    expect(out.board_basis).toBe("Half Board"); // the spec's own match wins over the text scan
  });

  it("normalises vocabulary variants to canonical names", () => {
    const out = runExtractionSpec(
      OVERFITTED_SPEC,
      { ...CTX, text: "Bed & Breakfast\n£500" },
      "2026-08-05T00:00:00Z",
    );
    expect(out.board_basis).toBe("Bed and Breakfast");
  });
});
