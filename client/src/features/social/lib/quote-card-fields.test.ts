import { describe, it, expect } from "vitest";
import type { EnrichedQuote } from "@/features/quote/types";
import { buildGenerateParams, getSubtitle, pricePerPersonLabel } from "./quote-card-fields";

function quote(overrides: Record<string, unknown>): EnrichedQuote {
  return { id: "q1", num_of_nights: 0, ...overrides } as unknown as EnrichedQuote;
}

describe("getSubtitle", () => {
  it("joins country and destination", () => {
    expect(getSubtitle(quote({ country_name: "Spain", destination_name: "Majorca" }))).toBe("Spain · Majorca");
  });
  it("falls back to park name, then park location, then a dash", () => {
    expect(getSubtitle(quote({ park_name: "Oakwood", park_location: "Devon" }))).toBe("Oakwood");
    expect(getSubtitle(quote({ park_location: "Devon" }))).toBe("Devon");
    expect(getSubtitle(quote({}))).toBe("—");
  });
});

describe("pricePerPersonLabel", () => {
  it("formats with en-GB grouping", () => {
    expect(pricePerPersonLabel(quote({ price_per_person: "1379" }))).toBe("£1,379.00pp");
  });
  it("shows a dash when absent or invalid", () => {
    expect(pricePerPersonLabel(quote({ price_per_person: null }))).toBe("—");
    expect(pricePerPersonLabel(quote({ price_per_person: "abc" }))).toBe("—");
  });
});

describe("buildGenerateParams", () => {
  it("errors when the travel date is missing", () => {
    expect(buildGenerateParams(quote({ travel_date: null }))).toEqual({
      error: "Cannot generate post — travel date is missing",
    });
  });
  it("builds hot tub params from park fields and omits board/airport", () => {
    const params = buildGenerateParams(
      quote({
        quote_type: "hot_tub_break",
        travel_date: "2026-11-01",
        park_name: "Oakwood",
        park_location: "Devon",
        country_name: "UK",
        num_of_nights: 0,
        lodge_name: "Lodge 1",
        accommodations: [{ accomodation_name: "X", board_basis_name: "BB" }],
      }),
    );
    expect(params).toMatchObject({
      quoteId: "q1",
      title: "Holiday Deal",
      destination: "Oakwood, Devon",
      nights: 1,
      boardBasis: undefined,
      departureAirport: undefined,
      travelDate: "2026-11-01",
      lodgeName: "Lodge 1",
    });
  });
  it("uses country and destination plus board basis for a standard holiday", () => {
    const params = buildGenerateParams(
      quote({
        travel_date: "2026-11-01",
        title: "Sun",
        country_name: "Spain",
        destination_name: "Majorca",
        num_of_nights: 7,
        departing_airport_name: "LGW",
        accommodations: [{ accomodation_name: "H", board_basis_name: "All Inclusive" }],
      }),
    );
    expect(params).toMatchObject({
      destination: "Spain, Majorca",
      nights: 7,
      boardBasis: "All Inclusive",
      departureAirport: "LGW",
    });
  });
});
