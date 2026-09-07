import { describe, expect, it } from "vitest";
import { validateQuote, type ValidationContext } from "./extraction.validate";
import type { ScrapedQuoteJson } from "../../easyjet/easyjet.types";
import type { ExtractionSpec } from "./extraction.types";

// A minimally-complete, otherwise-clean quote. Every test below starts from
// this and mutates only the field(s) under test, so a failing assertion
// points at exactly the check that fired.
function baseQuote(overrides: Partial<ScrapedQuoteJson> = {}): ScrapedQuoteJson {
  return {
    source_url: "https://example.com/deal",
    scraped_at: "2026-09-05T00:00:00Z",
    tour_operator: "Example Holidays",
    travel_date: "2026-12-01",
    no_of_nights: 7,
    adults: 2,
    children: 0,
    infants: 0,
    sales_price: 2000,
    price_per_person: 1000,
    currency: "GBP",
    discount: 0,
    tourist_tax_total: 0,
    promotion_code: "",
    promotion_discount: 0,
    country: "Spain",
    destination: "Costa Dorada",
    resort: "Salou",
    accommodation: "Hotel Regente",
    quote_title: "Hotel Regente",
    board_basis: "All Inclusive",
    room_type: "Double",
    check_in_date_time: "2026-12-01",
    transfer_type: "Shared",
    hotel_description: "",
    hotel_images: [],
    room_images: [],
    flights: [],
    transfers: [],
    included_luggage: [],
    star_rating: "4",
    review_score: null,
    ...overrides,
  };
}

// Default URL deliberately uses an unmapped TLD (not .com/.co.uk/etc.) so
// tests unrelated to currency don't accidentally trip CURRENCY_UNVERIFIED via
// the domain-inference fallback — currency tests below set their own url/text.
function ctx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return { url: "https://example.internal/deal", text: "", ...overrides };
}

describe("validateQuote — money", () => {
  it("flags a zero sales_price as an error, never merely empty (failed price rule bug)", () => {
    const result = validateQuote(baseQuote({ sales_price: 0 }), ctx());
    expect(result.level).toBe("error");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "PRICE_ZERO", level: "error" }));
  });

  it("flags a missing sales_price the same as zero", () => {
    const result = validateQuote(baseQuote({ sales_price: undefined as unknown as number }), ctx());
    expect(result.issues.some((i) => i.code === "PRICE_ZERO")).toBe(true);
  });

  it("does not flag PRICE_ZERO for a genuine non-zero price", () => {
    const result = validateQuote(baseQuote(), ctx());
    expect(result.issues.some((i) => i.code === "PRICE_ZERO")).toBe(false);
  });

  it("catches the Cunard bug: a per-person figure recorded as the total", () => {
    // 2 adults at £1,200pp should total ~£2,400, not £1,200.
    const quote = baseQuote({ sales_price: 1200, price_per_person: 1200, adults: 2 });
    const result = validateQuote(quote, ctx());
    expect(result.level).toBe("error");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "PRICE_PARTY_MISMATCH", level: "error" }));
  });

  it("tolerates a small (<=5%) gap between sales_price and price_per_person x adults", () => {
    // 2 x 1000 = 2000; 2040 is a 2% gap (single supplement / rounding).
    const quote = baseQuote({ sales_price: 2040, price_per_person: 1000, adults: 2 });
    const result = validateQuote(quote, ctx());
    expect(result.issues.some((i) => i.code === "PRICE_PARTY_MISMATCH")).toBe(false);
  });

  it("flags a total cheaper than the per-person price", () => {
    const quote = baseQuote({ sales_price: 500, price_per_person: 1000, adults: 2 });
    const result = validateQuote(quote, ctx());
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "PRICE_BELOW_PER_PERSON", level: "error" }));
  });
});

describe("validateQuote — currency", () => {
  it("flags a mismatch against an explicit ISO code stated on the page", () => {
    const quote = baseQuote({ currency: "GBP" });
    const result = validateQuote(quote, ctx({ text: "Rates are in USD. Total price: 3000" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CURRENCY_MISMATCH", level: "error" }));
  });

  it("flags a mismatch against Royal Caribbean's selectedCurrencyCode URL param", () => {
    const quote = baseQuote({ currency: "GBP" });
    const result = validateQuote(quote, ctx({ url: "https://www.royalcaribbean.com/deal?selectedCurrencyCode=USD" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CURRENCY_MISMATCH", level: "error" }));
  });

  it("flags a mismatch against Carnival's currency URL param — the $3,000-imported-as-GBP bug", () => {
    const quote = baseQuote({ currency: "GBP", sales_price: 3000 });
    const result = validateQuote(quote, ctx({ url: "https://www.carnival.com/deal?currency=USD" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CURRENCY_MISMATCH", level: "error" }));
  });

  it("flags a mismatch against a currency symbol actually printed in the text", () => {
    const quote = baseQuote({ currency: "GBP" });
    const result = validateQuote(quote, ctx({ text: "Total price: $2,499 per couple" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CURRENCY_MISMATCH", level: "error" }));
  });

  it("does not flag a currency that agrees with the strongest available evidence", () => {
    const quote = baseQuote({ currency: "USD" });
    const result = validateQuote(quote, ctx({ text: "Rates are in USD.", url: "https://www.carnival.com/deal" }));
    expect(result.issues.some((i) => i.code === "CURRENCY_MISMATCH")).toBe(false);
    expect(result.issues.some((i) => i.code === "CURRENCY_UNVERIFIED")).toBe(false);
  });

  it("warns (not errors) when currency can only be resolved from the domain TLD", () => {
    // .co.uk implies GBP, but nothing on the page/URL actually states a currency.
    const quote = baseQuote({ currency: "GBP" });
    const result = validateQuote(quote, ctx({ url: "https://www.example.co.uk/deal", text: "A lovely holiday" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CURRENCY_UNVERIFIED", level: "warn" }));
    expect(result.issues.some((i) => i.code === "CURRENCY_MISMATCH")).toBe(false);
    expect(result.level).toBe("warn");
  });

  it("warns when no currency evidence exists at all — this is what the interpreter's `|| 'GBP'` default hides", () => {
    const quote = baseQuote({ currency: "GBP" });
    const result = validateQuote(quote, ctx({ url: "https://not-a-real-tld.zzz/deal", text: "A lovely holiday" }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CURRENCY_UNVERIFIED", level: "warn" }));
  });
});

describe("validateQuote — dates", () => {
  it("flags a non-ISO travel_date", () => {
    const result = validateQuote(baseQuote({ travel_date: "01/12/2026" }), ctx());
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "DATE_NOT_ISO", level: "error" }));
  });

  it("flags a travel_date more than 3 years in the future", () => {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 5);
    const iso = future.toISOString().slice(0, 10);
    const result = validateQuote(baseQuote({ travel_date: iso }), ctx());
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "DATE_OUT_OF_RANGE", level: "error" }));
  });

  it("flags a travel_date far in the past", () => {
    const result = validateQuote(baseQuote({ travel_date: "2020-01-01" }), ctx());
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "DATE_OUT_OF_RANGE", level: "error" }));
  });

  it("accepts a travel_date within the plausible window and does not double-flag it as non-ISO", () => {
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 30);
    const iso = soon.toISOString().slice(0, 10);
    const result = validateQuote(baseQuote({ travel_date: iso }), ctx());
    expect(result.issues.some((i) => i.code === "DATE_NOT_ISO" || i.code === "DATE_OUT_OF_RANGE")).toBe(false);
  });

  it("accepts yesterday (today - 1 day is the lower bound)", () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const iso = yesterday.toISOString().slice(0, 10);
    const result = validateQuote(baseQuote({ travel_date: iso }), ctx());
    expect(result.issues.some((i) => i.code === "DATE_OUT_OF_RANGE")).toBe(false);
  });
});

describe("validateQuote — cross-field consistency", () => {
  it("flags no_of_nights disagreeing with the parsed itinerary's day count", () => {
    const itinerary = [1, 2, 3, 4].map((day) => ({ day, description: `Day ${day}` }));
    const quote = baseQuote({ no_of_nights: 7, itinerary });
    const result = validateQuote(quote, ctx());
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "NIGHTS_ITINERARY_MISMATCH", level: "warn" }));
  });

  it("does not flag when no_of_nights correctly equals itinerary days - 1", () => {
    const itinerary = [1, 2, 3, 4].map((day) => ({ day, description: `Day ${day}` }));
    const quote = baseQuote({ no_of_nights: 3, itinerary });
    const result = validateQuote(quote, ctx());
    expect(result.issues.some((i) => i.code === "NIGHTS_ITINERARY_MISMATCH")).toBe(false);
  });

  it("catches the Cunard bug: title says 28 nights, body says 27", () => {
    const quote = baseQuote({ no_of_nights: 27 });
    const result = validateQuote(
      quote,
      ctx({ title: "28-night Transatlantic Crossing", text: "This 27 nights sailing departs Southampton." }),
    );
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "NIGHTS_SOURCE_CONFLICT", level: "warn" }));
  });

  it("does not flag nights conflict when title and body agree", () => {
    const quote = baseQuote({ no_of_nights: 27 });
    const result = validateQuote(
      quote,
      ctx({ title: "27-night Transatlantic Crossing", text: "This 27 nights sailing departs Southampton." }),
    );
    expect(result.issues.some((i) => i.code === "NIGHTS_SOURCE_CONFLICT")).toBe(false);
  });

  it("does not flag nights conflict when only one source states a night count", () => {
    const quote = baseQuote({ no_of_nights: 27 });
    const result = validateQuote(quote, ctx({ title: "27-night Transatlantic Crossing", text: "A wonderful sailing." }));
    expect(result.issues.some((i) => i.code === "NIGHTS_SOURCE_CONFLICT")).toBe(false);
  });
});

// The RC drawer failure: a cruise checkout captured with its "View Ports"
// drawer collapsed had the whole day-by-day itinerary missing from `text`,
// and the deal imported with no itinerary — silently. Never fires without
// evidence the page actually has one, since a cruise summary page CAN
// legitimately print no day-by-day plan (Virgin Voyages).
describe("validateQuote — cruise itinerary missing", () => {
  it("flags a cruise whose spec declares an itineraryRegex but produced no itinerary", () => {
    const quote = baseQuote({ cruise_line: "Royal Caribbean", ship_name: "Freedom of the Seas", itinerary: [] });
    const spec = { version: 1, fields: {}, itineraryRegex: "Day\\s*(\\d+)[:\\s]+([^\\n]+)" } as ExtractionSpec;
    const result = validateQuote(quote, ctx({ spec }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CRUISE_ITINERARY_MISSING", level: "warn" }));
  });

  it("flags a cruise whose captured text mentions an itinerary but none was extracted", () => {
    const quote = baseQuote({ cruise_line: "Royal Caribbean", ship_name: "Freedom of the Seas" });
    const result = validateQuote(quote, ctx({ text: "View Ports\nItinerary\nSee your full day-by-day plan." }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CRUISE_ITINERARY_MISSING", level: "warn" }));
  });

  it("flags a cruise whose HEADINGS mention an itinerary even when the collapsed body text doesn't", () => {
    // This is the exact RC shape: the drawer's own heading survives collapse,
    // but the body text under it (which document.body.innerText also skips)
    // never reaches `text` at all.
    const quote = baseQuote({ cruise_line: "Royal Caribbean", ship_name: "Freedom of the Seas" });
    const result = validateQuote(quote, ctx({ text: "Leaving from\nSouthampton, England", headings: ["Freedom of the Seas", "Itinerary"] }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CRUISE_ITINERARY_MISSING", level: "warn" }));
  });

  it("does not flag a cruise that already has an itinerary", () => {
    const itinerary = [1, 2, 3].map((day) => ({ day, description: `Day ${day}` }));
    const quote = baseQuote({ cruise_line: "Royal Caribbean", ship_name: "Freedom of the Seas", itinerary });
    const result = validateQuote(quote, ctx({ text: "Itinerary\nDay 1\nDay 2\nDay 3" }));
    expect(result.issues.some((i) => i.code === "CRUISE_ITINERARY_MISSING")).toBe(false);
  });

  it("does not flag a non-cruise deal with no itinerary", () => {
    const quote = baseQuote({ cruise_line: undefined });
    const result = validateQuote(quote, ctx({ text: "Itinerary details available on request." }));
    expect(result.issues.some((i) => i.code === "CRUISE_ITINERARY_MISSING")).toBe(false);
  });

  it("does not flag a cruise that legitimately has no day-by-day plan (Virgin Voyages' summary page)", () => {
    // No itineraryRegex declared, and nothing on the page mentions an
    // itinerary at all — the spec author never said this supplier prints one.
    const quote = baseQuote({ cruise_line: "Virgin Voyages", ship_name: "Valiant Lady" });
    const spec = { version: 1, fields: {} } as ExtractionSpec;
    const result = validateQuote(
      quote,
      ctx({ text: "Your Voyage\nSouthern Caribbean & Aruban Nights\n7 NIGHTS", spec }),
    );
    expect(result.issues.some((i) => i.code === "CRUISE_ITINERARY_MISSING")).toBe(false);
  });
});

// MSC's cruise-summary page states MORE ports than it renders: "Santa Cruz De
// Tenerife | Puerto Del Rosario | Funchal (+ 3)" — 3 in the DOM, 3 more the
// page itself says exist but that load only once "View itinerary" is opened.
// This is a DIFFERENT failure from CRUISE_ITINERARY_MISSING: the itinerary is
// non-empty and LOOKS complete, so the zero-row check never fires.
describe("validateQuote — cruise itinerary partial (the MSC '(+ N)' page)", () => {
  it("flags a cruise whose port list states more ports than were extracted", () => {
    const quote = baseQuote({
      cruise_line: "MSC Cruises",
      ship_name: "MSC Virtuosa",
      itinerary: [
        { day: 1, description: "Santa Cruz De Tenerife" },
        { day: 2, description: "Puerto Del Rosario" },
        { day: 3, description: "Funchal" },
      ],
    });
    const result = validateQuote(
      quote,
      ctx({ text: "Itinerary:\nSanta Cruz De Tenerife | Puerto Del Rosario | Funchal (+ 3)" }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "CRUISE_ITINERARY_PARTIAL", level: "warn", field: "itinerary" }),
    );
  });

  it("does not flag a port list that declares no hidden ports", () => {
    const quote = baseQuote({
      cruise_line: "MSC Cruises",
      ship_name: "MSC Virtuosa",
      itinerary: [
        { day: 1, description: "Santa Cruz De Tenerife" },
        { day: 2, description: "Puerto Del Rosario" },
        { day: 3, description: "Funchal" },
      ],
    });
    const result = validateQuote(quote, ctx({ text: "Itinerary:\nSanta Cruz De Tenerife | Puerto Del Rosario | Funchal" }));
    expect(result.issues.some((i) => i.code === "CRUISE_ITINERARY_PARTIAL")).toBe(false);
  });

  it("never fires alongside CRUISE_ITINERARY_MISSING for the same page", () => {
    // Zero rows extracted at all — that belongs to CRUISE_ITINERARY_MISSING,
    // not this check, even though the page's port list states hidden ports.
    const quote = baseQuote({ cruise_line: "MSC Cruises", ship_name: "MSC Virtuosa", itinerary: [] });
    const result = validateQuote(
      quote,
      ctx({ text: "Itinerary:\nSanta Cruz De Tenerife | Puerto Del Rosario | Funchal (+ 3)" }),
    );
    expect(result.issues.some((i) => i.code === "CRUISE_ITINERARY_MISSING")).toBe(true);
    expect(result.issues.some((i) => i.code === "CRUISE_ITINERARY_PARTIAL")).toBe(false);
  });

  it("does not flag a day/port-table itinerary that has nothing to do with a pipe-separated port list", () => {
    const itinerary = [1, 2, 3].map((day) => ({ day, description: `Day ${day}` }));
    const quote = baseQuote({ cruise_line: "Royal Caribbean", ship_name: "Freedom of the Seas", itinerary });
    const result = validateQuote(quote, ctx({ text: "Itinerary\nDay 1\nDay 2\nDay 3" }));
    expect(result.issues.some((i) => i.code === "CRUISE_ITINERARY_PARTIAL")).toBe(false);
  });

  it("does not flag a non-cruise deal", () => {
    const quote = baseQuote({ cruise_line: undefined, itinerary: undefined });
    const result = validateQuote(
      quote,
      ctx({ text: "Itinerary:\nSanta Cruz De Tenerife | Puerto Del Rosario | Funchal (+ 3)" }),
    );
    expect(result.issues.some((i) => i.code === "CRUISE_ITINERARY_PARTIAL")).toBe(false);
  });
});

describe("validateQuote — prose detection", () => {
  it("catches TUI's Prague-fallback shape: a marketing sentence in an airport-name field", () => {
    const quote = baseQuote({
      flights: [
        {
          flight_number: "TOM123",
          flight_type: "outbound",
          departing_airport: "MAN",
          departing_airport_name: "Manchester",
          departure_date_time: "2026-12-01T10:00",
          arrival_airport: "AGP",
          arrival_airport_name: "to your hotel, and back to the airport at the end of your stay",
          arrival_date_time: "2026-12-01T13:00",
        },
      ],
    });
    const result = validateQuote(quote, ctx());
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "FIELD_LOOKS_LIKE_PROSE", field: "flights[0].arrival_airport_name" }),
    );
  });

  it("catches a marketing sentence in ship_name", () => {
    const quote = baseQuote({ ship_name: "our ships to make your voyage as comfortable as possible" });
    const result = validateQuote(quote, ctx());
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FIELD_LOOKS_LIKE_PROSE", field: "ship_name" }));
  });

  it("catches a short stock phrase in accommodation via the word-count rule", () => {
    const quote = baseQuote({ accommodation: "Thrilling onboard activities" });
    const result = validateQuote(quote, ctx());
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FIELD_LOOKS_LIKE_PROSE", field: "accommodation" }));
  });

  it("catches Carnival's IMPORTANT NOTICE title via the repeated-on-page rule", () => {
    const text = Array(5).fill("IMPORTANT NOTICE: rates are per person.").join(" ");
    const quote = baseQuote({ quote_title: "IMPORTANT NOTICE" });
    const result = validateQuote(quote, ctx({ text }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FIELD_LOOKS_LIKE_PROSE", field: "quote_title" }));
  });

  it("catches the overfitted room-type example, 'Best room', via repetition on the page", () => {
    const text = Array(6).fill("(1) Best room choice according to your dates").join("\n");
    // room_type isn't one of the checked identity fields, but accommodation
    // sharing the same short repeated phrase demonstrates the same mechanism.
    const quote = baseQuote({ accommodation: "Best room" });
    const result = validateQuote(quote, ctx({ text }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "FIELD_LOOKS_LIKE_PROSE", field: "accommodation" }));
  });

  it("does not flag a normal, short, non-repeated identity field", () => {
    const quote = baseQuote({ accommodation: "Hotel Regente", ship_name: undefined });
    const result = validateQuote(quote, ctx({ text: "Hotel Regente is a lovely 4-star property." }));
    expect(result.issues.some((i) => i.code === "FIELD_LOOKS_LIKE_PROSE")).toBe(false);
  });
});

describe("validateQuote — capture completeness (wait.textMatches as a post-hoc gate)", () => {
  const spec = { version: 1, fields: {}, wait: { textMatches: "£\\s?[\\d,]{2,}" } } as ExtractionSpec;

  it("flags a capture whose text never matches the spec's own ready-signal", () => {
    const result = validateQuote(baseQuote(), ctx({ text: "Loading your quote…", spec }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "CAPTURE_INCOMPLETE", level: "error" }));
  });

  it("does not flag a capture whose text does match the ready-signal", () => {
    const result = validateQuote(baseQuote(), ctx({ text: "Your total price: £2,000", spec }));
    expect(result.issues.some((i) => i.code === "CAPTURE_INCOMPLETE")).toBe(false);
  });

  it("skips the check entirely when no page text is available (e.g. the automated /scrape path)", () => {
    const result = validateQuote(baseQuote(), ctx({ text: "", spec }));
    expect(result.issues.some((i) => i.code === "CAPTURE_INCOMPLETE")).toBe(false);
  });
});

describe("validateQuote — spec coverage", () => {
  it("warns when more than 40% of the spec's declared fields resolved empty", () => {
    const spec = {
      version: 1,
      fields: {
        sales_price: { from: "text", regex: "x" },
        board_basis: { from: "text", regex: "x" },
        room_type: { from: "text", regex: "x" },
        promotion_code: { from: "text", regex: "x" },
        star_rating: { from: "text", regex: "x" },
      },
    } as unknown as ExtractionSpec;
    // sales_price and price_per_person are non-empty (2000/1000), the other
    // three declared fields (board_basis is set on baseQuote, so make it empty
    // too) are blank — 3/5 = 60% empty.
    const quote = baseQuote({ board_basis: "", room_type: "", promotion_code: "", star_rating: "" });
    const result = validateQuote(quote, ctx({ spec }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "SPEC_COVERAGE_LOW", level: "warn" }));
  });

  it("does not warn when coverage is healthy", () => {
    const spec = {
      version: 1,
      fields: {
        sales_price: { from: "text", regex: "x" },
        board_basis: { from: "text", regex: "x" },
      },
    } as unknown as ExtractionSpec;
    const result = validateQuote(baseQuote(), ctx({ spec }));
    expect(result.issues.some((i) => i.code === "SPEC_COVERAGE_LOW")).toBe(false);
  });

  it("is a no-op when no spec is supplied", () => {
    const result = validateQuote(baseQuote({ sales_price: 0, board_basis: "", room_type: "" }), ctx());
    expect(result.issues.some((i) => i.code === "SPEC_COVERAGE_LOW")).toBe(false);
  });
});

describe("validateQuote — overall level and issue collection", () => {
  it("returns 'ok' with no issues for a clean quote", () => {
    // A quote is only genuinely "clean" if every check has what it needs to
    // agree with it — including currency, which the default ctx() deliberately
    // starves of evidence (see the ctx() comment above) so unrelated tests
    // don't trip CURRENCY_UNVERIFIED by accident. That default ctx() is
    // therefore not itself a "clean" fixture: with no currency evidence
    // anywhere, "warns when no currency evidence exists at all" (above) proves
    // CURRENCY_UNVERIFIED is the intended, correct outcome for it. So this
    // fixture supplies the missing evidence (page text stating the same
    // currency as the quote) instead of weakening the currency check.
    const result = validateQuote(baseQuote(), ctx({ text: "All prices shown are in GBP." }));
    expect(result).toEqual({ level: "ok", issues: [] });
  });

  it("collects every failing check instead of stopping at the first (Fellegi-Holt localisation)", () => {
    const quote = baseQuote({ sales_price: 0, travel_date: "not-a-date", ship_name: "Thrilling onboard activities" });
    const result = validateQuote(quote, ctx());
    const codes = result.issues.map((i) => i.code);
    expect(codes).toContain("PRICE_ZERO");
    expect(codes).toContain("DATE_NOT_ISO");
    expect(codes).toContain("FIELD_LOOKS_LIKE_PROSE");
    expect(result.level).toBe("error");
  });

  it("never throws, regardless of how malformed the input is", () => {
    const malformed = baseQuote({ travel_date: "", currency: "", itinerary: [] });
    expect(() => validateQuote(malformed, ctx())).not.toThrow();
  });
});

// ─── Prose heuristic: measured against real pipeline output ──────────────────
// The prose check earns its place only if it stays quiet on correct data. A
// word-count limit tight enough to catch a SHORT stock phrase ("Thrilling
// onboard activities", 3 words) flagged seven of the ten correct values this
// pipeline has actually produced — every real cruise title, and "Freedom of
// the Seas" — while still missing "IMPORTANT NOTICE" and "Best room". A
// warning that fires on most valid imports teaches agents to ignore the panel,
// which hides the real failures. These two lists are the measurement; keep
// both green when tuning.
describe("validateQuote — prose heuristic does not cry wolf", () => {
  const CORRECT: [keyof ScrapedQuoteJson, string][] = [
    ["ship_name", "Freedom of the Seas"],
    ["ship_name", "Queen Elizabeth"],
    ["ship_name", "Carnival Conquest"],
    ["ship_name", "VALIANT LADY"],
    ["cruise_title", "Southern Caribbean & Aruban Nights"],
    ["cruise_title", "7 Night Spain & Portugal Cruise"],
    ["quote_title", "3-Day The Bahamas from Miami, FL"],
    ["quote_title", "Spain and Eastern Caribbean"],
    ["accommodation", "Britannia Inside Staterooms"],
    ["accommodation", "Plaza Prague Hotel"],
  ];

  it.each(CORRECT)("leaves a real %s alone: %s", (field, value) => {
    const result = validateQuote(baseQuote({ [field]: value } as Partial<ScrapedQuoteJson>), ctx());
    expect(result.issues.filter((i) => i.code === "FIELD_LOOKS_LIKE_PROSE")).toEqual([]);
  });

  const MIS_EXTRACTIONS: [keyof ScrapedQuoteJson, string][] = [
    // Royal Caribbean — the case-insensitive "Onboard" prose match.
    ["ship_name", "Thrilling onboard activities"],
    // Cunard — "On board ([A-Za-z ]+)" catching the accommodation blurb.
    ["ship_name", "our ships to make your voyage as comfortable as possible"],
    // Carnival — a positional headings rule silently reading the page body.
    ["quote_title", "IMPORTANT NOTICE"],
  ];

  it.each(MIS_EXTRACTIONS)("still catches %s = %s", (field, value) => {
    const result = validateQuote(baseQuote({ [field]: value } as Partial<ScrapedQuoteJson>), ctx());
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "FIELD_LOOKS_LIKE_PROSE", level: "warn" }),
    );
  });
});

// A port list is not a day list. MSC prints "Santa Cruz De Tenerife | Puerto
// Del Rosario | Funchal (+ 3)" with no day against any port, so the rows carry
// sequence positions — and "(+ 3)" says the list is short by construction.
// Comparing nights to that row count is meaningless, and firing it alongside
// CRUISE_ITINERARY_PARTIAL would raise two warnings for one already-reported
// fact. A panel that cries wolf gets ignored, which is what the prose
// heuristic already taught us.
describe("validateQuote — a partial port list raises ONE warning, not two", () => {
  const MSC_TEXT = [
    "Your cruise", "Spain, Portugal",
    "Duration:", "7 nights",
    "Itinerary:", "Santa Cruz De Tenerife | Puerto Del Rosario | Funchal (+ 3)",
  ].join("\n");

  const partialQuote = () =>
    baseQuote({
      cruise_line: "MSC Cruises",
      ship_name: "MSC Fantasia",
      no_of_nights: 7,
      itinerary: [
        { day: 1, description: "Santa Cruz De Tenerife" },
        { day: 2, description: "Puerto Del Rosario" },
        { day: 3, description: "Funchal" },
      ],
    } as Partial<ScrapedQuoteJson>);

  it("reports the itinerary as partial", () => {
    const codes = validateQuote(partialQuote(), ctx({ text: MSC_TEXT })).issues.map((i) => i.code);
    expect(codes).toContain("CRUISE_ITINERARY_PARTIAL");
  });

  it("does NOT also complain that nights disagree with the day count", () => {
    // 7 nights vs 3 rows would trip the cross-field check, but those rows are
    // ports, not days, and three more are known to be missing.
    const codes = validateQuote(partialQuote(), ctx({ text: MSC_TEXT })).issues.map((i) => i.code);
    expect(codes).not.toContain("NIGHTS_ITINERARY_MISMATCH");
  });

  it("still checks nights against a REAL day table", () => {
    // A genuine day/port itinerary carries no port-list line, so the
    // cross-field check applies exactly as before.
    const q = baseQuote({
      cruise_line: "Royal Caribbean",
      // 4 days on the table means 3 nights, so 5 is a genuine disagreement —
      // exactly what this check exists to surface.
      no_of_nights: 5,
      itinerary: [
        { day: 1, description: "Southampton, England" },
        { day: 2, description: "Cruising" },
        { day: 3, description: "Bilbao, Spain" },
        { day: 4, description: "Southampton, England" },
      ],
    } as Partial<ScrapedQuoteJson>);
    const codes = validateQuote(q, ctx({ text: "Day\tPort\n1\nSouthampton" })).issues.map((i) => i.code);
    expect(codes).toContain("NIGHTS_ITINERARY_MISMATCH");
  });
});

// When the two price fields disagree, the arithmetic proves only that they
// can't both be right — never which one is wrong. Provenance settles it: the
// attributed field is the one the client WITHHOLDS, so blaming a hand-verified
// pick throws away the trustworthy number and keeps the guess.
//
// Real case: an agent picked Virgin Voyages' sales_price ("Grand total" ->
// £2,013.10, verified on the page), while the generated price_per_person rule
// was reading "£2,065.10 (Includes taxes & fees)" — the party TOTAL, not a
// per-person fare. The pair couldn't reconcile, the verified total was
// withheld, and the form fell back to 0 with the agent's own pick discarded.
describe("validateQuote — price disagreements blame the UNVERIFIED field", () => {
  const specWithPickedTotal = {
    version: 1,
    fields: {
      sales_price: { from: "text", regex: "Grand total", origin: "picked", verifiedValue: "£2,013.10" },
      price_per_person: { from: "text", regex: "\(Includes taxes & fees\)" },
    },
  } as unknown as ExtractionSpec;

  const mismatched = () => baseQuote({ sales_price: 2013.1, price_per_person: 2065.1, adults: 2 });

  it("blames price_per_person when sales_price was picked and it was not", () => {
    const issues = validateQuote(mismatched(), ctx({ spec: specWithPickedTotal })).issues;
    const mismatch = issues.find((i) => i.code === "PRICE_PARTY_MISMATCH");
    const below = issues.find((i) => i.code === "PRICE_BELOW_PER_PERSON");
    expect(mismatch?.field).toBe("price_per_person");
    expect(below?.field).toBe("price_per_person");
  });

  it("still blames sales_price when NEITHER field was verified", () => {
    const issues = validateQuote(mismatched(), ctx()).issues;
    expect(issues.find((i) => i.code === "PRICE_PARTY_MISMATCH")?.field).toBe("sales_price");
  });

  it("blames sales_price when the per-person figure is the verified one", () => {
    const bothPicked = {
      version: 1,
      fields: {
        sales_price: { from: "text", regex: "Grand total", origin: "picked" },
        price_per_person: { from: "text", regex: "pp", origin: "picked" },
      },
    } as unknown as ExtractionSpec;
    // With both verified there is no asymmetry to exploit, so the default holds.
    expect(validateQuote(mismatched(), ctx({ spec: bothPicked })).issues
      .find((i) => i.code === "PRICE_PARTY_MISMATCH")?.field).toBe("sales_price");
  });
});
