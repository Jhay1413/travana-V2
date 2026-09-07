import { describe, expect, it } from "vitest";
import { fieldRuleSchema, findUnsafeRules, specSchema } from "./extraction-ai.service";
import { runExtractionSpec } from "./extraction.interpreter";
import type { ExtractionSpec, FieldRule, FieldSource } from "./extraction.types";

// The validator and the interpreter must agree on which field sources exist.
// They drifted: FieldSource and the interpreter both had "headings", but the
// validator's enum did not, so `normaliseFrom` rewrote every heading rule to
// "text". The AI is told to read quote_title from the headings BY POSITION, so
// the positional regex then counted lines of the page BODY — Carnival's title
// came out "IMPORTANT NOTICE", the second line of a site banner.
const ALL_SOURCES: FieldSource[] = ["text", "title", "url", "images", "headings", "deepText"];

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

// ─── §1.7 / §4 Phase 1: exhaustive optional-key round-trip ───────────────────
//
// `imageContainerIncludes` is declared on ExtractionSpec and consumed by the
// interpreter (extraction.interpreter.ts:425, selectGalleryImages) but was
// missing from specSchema — Zod silently strips unknown keys, so it vanished
// on its way through the validator. This is the identical shape of bug as the
// missing "headings" source above, just on a spec-level key instead of a field
// source.
//
// `OPTIONAL_SPEC_SAMPLES` is typed as `Record<OptionalSpecKey, unknown>`, so
// TypeScript itself refuses to compile this file if a new optional key is
// added to ExtractionSpec and not added here. The round-trip assertion below
// then catches the sibling mistake this bug actually was: adding the key here
// (or to the type) but forgetting it in specSchema, where it would silently
// disappear rather than fail loudly.
type OptionalSpecKey = Exclude<keyof ExtractionSpec, "version" | "fields">;

const OPTIONAL_SPEC_SAMPLES: Record<OptionalSpecKey, unknown> = {
  wait: { textMatches: "\\$\\d+", timeoutMs: 5000 },
  constants: { tour_operator: "Acme Travel", currency: "GBP" },
  luggageRegex: "\\((\\d+)\\)\\s*(\\d+kg)",
  imageUrlIncludes: "cdn.example.com/gallery",
  imageContainerIncludes: "hotel-main-view",
  flightModalTrigger: "compare airport",
  itineraryRegex: "Day\\s*(\\d+)[:\\s]+([^\\n]+)",
  packageType: "cruise",
};

describe("specSchema round-trip: every ExtractionSpec key survives parsing", () => {
  it.each(Object.entries(OPTIONAL_SPEC_SAMPLES))("keeps %s unchanged", (key, value) => {
    const input = { version: 1, fields: {}, [key]: value };
    const parsed = specSchema.parse(input) as unknown as Record<string, unknown>;
    // Not `.toBeDefined()` — the key must survive with its EXACT value, not
    // merely exist. A key that parses but gets coerced/stripped-and-defaulted
    // would pass a weaker assertion and miss this class of bug entirely.
    expect(parsed[key]).toEqual(value);
  });
});

// ─── FIELD-RULE round-trip: every FieldRule key survives parsing ────────────
//
// The exact same bug shape, one level down: `imageContainerIncludes` was a
// spec-level key that Zod silently stripped; "headings" and "deepText" were
// FieldSource enum values that got silently normalised away. That's now THREE
// times this drift class has shipped. `FIELD_RULE_SAMPLES` is typed as
// `Record<FieldRuleKey, unknown>`, so TypeScript refuses to COMPILE this file
// if a key is added to FieldRule (extraction.types.ts) and not added here —
// the round-trip assertion then catches the sibling mistake: adding it here
// but forgetting fieldRuleSchema, where it would silently vanish instead of
// failing loudly.
type FieldRuleKey = keyof FieldRule;

const FIELD_RULE_SAMPLES: Record<FieldRuleKey, unknown> = {
  from: "headings",
  jsonPath: "offers[0].price",
  regex: "([\\d,]+\\.\\d{2})",
  group: 1,
  urlSegment: 2,
  transform: "number",
  map: { "Express transfers": "Shared Transfer" },
  fallback: "None",
  // Provenance (§4 Phase 3) — written by deriveSpecFromPicks (picker-spec.ts)
  // when a human verifies a field, never by the AI generator.
  origin: "picked",
  verifiedValue: "£1,447.00 GBP",
  strategy: "label-anchored",
  pickedAt: "2026-09-06T12:00:00.000Z",
};

describe("fieldRuleSchema round-trip: every FieldRule key survives parsing", () => {
  it.each(Object.entries(FIELD_RULE_SAMPLES))("keeps %s unchanged", (key, value) => {
    const input = { [key]: value };
    const parsed = fieldRuleSchema.parse(input) as unknown as Record<string, unknown>;
    // Not `.toBeDefined()` — see the spec-level round-trip above for why: the
    // key must survive with its EXACT value, not merely exist.
    expect(parsed[key]).toEqual(value);
  });
});

// ─── §4 Phase 2: reject overfitted / broken rules at generation time ─────────
//
// findUnsafeRules is the gate extractionAiService.generateSpecFromDom runs
// AFTER specSchema parsing, before a generated spec is trusted. Each check
// below corresponds to a confirmed shipped bug (see EXTRACTION_AUDIT.md §1.3,
// §1.4, §1.9) and is tested in isolation, without any AI call.
describe("findUnsafeRules: group 0 without a map", () => {
  it("rejects group: 0 with no map — returns the whole match, not a value", () => {
    // TUI's real arrival-airport rule: matches a full sentence and, with
    // group: 0, returns that entire sentence as the "airport name".
    const spec: ExtractionSpec = {
      version: 1,
      fields: {
        arrival_airport_name: {
          from: "text",
          regex: "to your hotel, and back to the airport at the end of your stay",
          group: 0,
        },
      },
    };
    const problems = findUnsafeRules(spec);
    expect(problems.some((p) => p.field === "arrival_airport_name")).toBe(true);
  });

  it("allows group: 0 when paired with a map (whole match is intentionally translated)", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: {
        hot_tub: {
          from: "text",
          regex: "hot tub",
          group: 0,
          map: { "hot tub": "true" },
        },
      },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });

  it("does not flag a normal group: 1 rule", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: { sales_price: { from: "text", regex: "Total: £([\\d,]+)", group: 1 } },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });
});

describe("findUnsafeRules: proper-noun fallback", () => {
  it('rejects fallback: "Prague" — a page-specific place, not fixed vocabulary', () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: { arrival_airport_name: { from: "text", regex: "Airport: ([^\\n]+)", fallback: "Prague" } },
    };
    const problems = findUnsafeRules(spec);
    expect(problems.some((p) => p.field === "arrival_airport_name")).toBe(true);
  });

  it('allows fallback: "None" — canonical transfer_type vocabulary', () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: {
        transfer_type: {
          from: "text",
          regex: "(Private Transfer|Shared Transfer)",
          map: { "Express transfers": "Shared Transfer" },
          fallback: "None",
        },
      },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });

  it('allows fallback: "Room Only" — canonical board_basis vocabulary', () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: { board_basis: { from: "text", regex: "(Room Only|Self Catering)", fallback: "Room Only" } },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });

  it('allows an ALL-CAPS fallback like "GBP" (not a proper-noun shape)', () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: { currency: { from: "text", regex: "\\b(GBP|USD|EUR)\\b", fallback: "GBP" } },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });

  it("allows a numeric fallback", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: { tourist_tax_total: { from: "text", regex: "Tourist tax: ([\\d.]+)", transform: "number", fallback: 0 } },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });
});

describe("findUnsafeRules: top-level pipe outside any group", () => {
  it("rejects Jet2's dead alternation — the top-level | splits the whole pattern", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: {
        departure_airport_name: {
          from: "text",
          regex: "(Manchester|Newcastle)\\s*\\(MAN|NCL\\)",
        },
      },
    };
    const problems = findUnsafeRules(spec);
    expect(problems.some((p) => p.field === "departure_airport_name")).toBe(true);
  });

  it("allows the board_basis vocabulary alternation (| fully inside a group)", () => {
    // The exact rule the system prompt asks the AI to write.
    const spec: ExtractionSpec = {
      version: 1,
      fields: {
        board_basis: {
          from: "text",
          regex:
            "(All Inclusive Plus|All Inclusive|Half Board Plus|Half Board|Full Board Plus|Full Board|Bed and Breakfast|Self Catering|Room Only)",
        },
      },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });

  it("allows a | inside a character class", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: { room_type: { from: "text", regex: "[A-Z|]{3}\\d+" } },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });

  it("allows an escaped \\| (a literal pipe character, not alternation)", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: { room_type: { from: "text", regex: "Suite\\s*A\\|B" } },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });

  it("also checks luggageRegex and itineraryRegex, not just field rules", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: {},
      luggageRegex: "(Manchester|Newcastle)\\s*\\(MAN|NCL\\)",
    };
    const problems = findUnsafeRules(spec);
    expect(problems.some((p) => p.field === "luggageRegex")).toBe(true);
  });
});

describe("findUnsafeRules: long literal anchor text", () => {
  it("rejects Carnival's marketing-sentence anchor (~75 literal characters)", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: {
        price_per_person: {
          from: "text",
          regex: "Rates are in US Dollars, average per person and based on double occupancy\\..*?\\$([\\d,]+\\.\\d{2})",
          transform: "number",
        },
      },
    };
    const problems = findUnsafeRules(spec);
    expect(problems.some((p) => p.field === "price_per_person")).toBe(true);
  });

  it("allows a short structural label anchor", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: { room_type: { from: "text", regex: "ROOM\\s*\\d+\\s*\\n+\\s*([^\\n]+)" } },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });

  it("allows the longest individual board_basis vocabulary term (well under the limit)", () => {
    const spec: ExtractionSpec = {
      version: 1,
      fields: {
        board_basis: {
          from: "text",
          regex:
            "(All Inclusive Plus|All Inclusive|Half Board Plus|Half Board|Full Board Plus|Full Board|Bed and Breakfast|Self Catering|Room Only)",
        },
      },
    };
    expect(findUnsafeRules(spec)).toEqual([]);
  });
});

// ─── The guards must not reject LEGITIMATE idioms ────────────────────────────
// Shipped too strict and 502'd real imports: `group: 0` was treated as a bug in
// itself, but it is the normal shape of a PRESENCE DETECTOR — the whole match
// IS the value — and stored specs use it for "Hong Kong Island West" (resort),
// "Transfer included" (transfer type) and "hot tub" (a flag). A top-level "|"
// is likewise harmless when reading group 0, since there is no capture to lose,
// and a proper-noun fallback naming the SUPPLIER is correct rather than
// overfitted. A guard that blocks the agent's work is worse than the bug it
// prevents, so these must stay green.
describe("findUnsafeRules: legitimate idioms are not rejected", () => {
  const flagged = (field: string, rule: unknown): boolean =>
    findUnsafeRules({ version: 1, fields: { [field]: rule } } as never).length > 0;

  it("allows a group:0 presence detector returning a place name", () => {
    expect(flagged("resort", { from: "text", group: 0, regex: "Hong Kong Island West" })).toBe(false);
  });

  it("allows a top-level pipe when group 0 returns the whole match", () => {
    expect(flagged("country", { from: "text", group: 0, regex: "Hong Kong SAR, China|Hong Kong" })).toBe(false);
  });

  it("allows a long literal on a FLAG field, where matching the phrase is the detection", () => {
    expect(flagged("cruise_only", { from: "text", regex: "(Direct flights and transfers included)" })).toBe(false);
    expect(flagged("hot_tub", { from: "text", group: 0, regex: "hot tub" })).toBe(false);
  });

  it("allows a proper-noun fallback naming the supplier itself", () => {
    // Both are real stored rules: the operator of a cruise line's own site IS
    // that line, on every page, forever.
    expect(flagged("cruise_line", { from: "title", group: 0, regex: "Royal Caribbean", fallback: "Royal Caribbean" })).toBe(false);
    expect(flagged("cruise_line", { from: "text", fallback: "Virgin Voyages" })).toBe(false);
  });
});

// ─── …while every real bug is still caught ───────────────────────────────────
describe("findUnsafeRules: the real bugs are still caught", () => {
  const flagged = (field: string, rule: unknown): boolean =>
    findUnsafeRules({ version: 1, fields: { [field]: rule } } as never).length > 0;

  it("catches TUI's whole-SENTENCE group:0 airport", () => {
    // The discriminator against the allowed detectors above is length: a value
    // is a name, a bug is a sentence.
    expect(flagged("arrival_airport_name", {
      from: "text", group: 0,
      regex: "to your hotel, and back to the airport at the end of your stay",
    })).toBe(true);
  });

  it("catches a proper-noun fallback on a per-deal field", () => {
    expect(flagged("arrival_airport_name", { from: "text", group: 1, regex: String.raw`Airport: ([^\n]+)`, fallback: "Prague" })).toBe(true);
  });

  it("catches Jet2's dead alternation when a capture group is being read", () => {
    expect(flagged("departure_airport_name", { from: "text", group: 1, regex: String.raw`(Manchester|Newcastle)\s*\(MAN|NCL\)` })).toBe(true);
  });

  it("catches Carnival's marketing-sentence anchor beside a capture", () => {
    expect(flagged("price_per_person", {
      from: "text", group: 1,
      regex: String.raw`Rates are in US Dollars, average per person and based on double occupancy\..*?\$([\d,]+\.\d{2})`,
    })).toBe(true);
  });
});
