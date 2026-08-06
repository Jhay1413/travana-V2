import { describe, expect, it } from "vitest";
import { buildDealEmbeddingText, buildDealEmbeddingMetadata } from "./deal-embedding";
import type { TravelDeal } from "@shared/schema";

function makeDeal(overrides: Partial<TravelDeal> = {}): TravelDeal {
  return {
    id: "deal-1",
    title: "All Inclusive Tunisia",
    subtitle: "Sun-soaked escape — Book Now",
    post: "<p>ignored</p>",
    resortSummary: "Beachfront resort in Hammamet with three pools.",
    hashtags: ["#Tunisia", "#AllInclusive"],
    travelDate: "2026-10-29",
    nights: 7,
    boardBasis: "All Inclusive",
    departureAirport: "Manchester",
    postSchedule: new Date("2026-08-01T09:00:00Z"),
    onlySocialsId: "os-uuid-1",
    luggageTransfers: "Included",
    price: "299.00",
    quote_id: "quote-1",
    created_at: new Date("2026-07-30T12:00:00Z"),
    ...overrides,
  };
}

describe("buildDealEmbeddingText", () => {
  it("includes the hotel name when provided (resolved from the quote, not the deal row)", () => {
    const text = buildDealEmbeddingText(makeDeal(), { hotelName: "Hotel Marhaba Palace" });
    expect(text).toContain("Hotel: Hotel Marhaba Palace");
    const meta = buildDealEmbeddingMetadata(makeDeal(), { hotelName: "Hotel Marhaba Palace" });
    expect(meta.hotelName).toBe("Hotel Marhaba Palace");
  });

  it("includes the public caption fields, price, and a human-readable travel date", () => {
    const text = buildDealEmbeddingText(makeDeal());
    expect(text).toContain("Title: All Inclusive Tunisia");
    expect(text).toContain("Subtitle: Sun-soaked escape — Book Now");
    // Customers echo the caption's wording ("the 29th October one") — the
    // spelled-out form is what makes those messages match.
    expect(text).toContain("Travel date: 2026-10-29 (29 October 2026)");
    expect(text).toContain("Nights: 7");
    expect(text).toContain("Board basis: All Inclusive");
    expect(text).toContain("Departure airport: Manchester");
    expect(text).toContain("Price: from £299.00 per person");
    expect(text).toContain("Hashtags: #Tunisia #AllInclusive");
  });

  it("skips missing fields cleanly and never embeds the post HTML", () => {
    const text = buildDealEmbeddingText(
      makeDeal({
        subtitle: null,
        resortSummary: null,
        hashtags: [],
        travelDate: null,
        boardBasis: null,
        departureAirport: null,
        luggageTransfers: null,
        price: null,
      }),
    );
    expect(text).toBe("Title: All Inclusive Tunisia\nNights: 7");
    expect(text).not.toContain("ignored");
  });

  it("skips an unparseable travel date rather than embedding garbage", () => {
    const text = buildDealEmbeddingText(makeDeal({ travelDate: "not-a-date" }));
    expect(text).not.toContain("Travel date");
  });
});

describe("buildDealEmbeddingMetadata", () => {
  it("carries the ids needed to hydrate live quote detail plus schedule info", () => {
    expect(buildDealEmbeddingMetadata(makeDeal())).toEqual({
      travelDealId: "deal-1",
      quoteId: "quote-1",
      onlySocialsId: "os-uuid-1",
      postSchedule: "2026-08-01T09:00:00.000Z",
      travelDate: "2026-10-29",
      nights: 7,
      price: "299.00",
      title: "All Inclusive Tunisia",
      hotelName: null,
    });
  });

  it("nulls optional fields instead of dropping the keys", () => {
    const meta = buildDealEmbeddingMetadata(makeDeal({ onlySocialsId: null, postSchedule: null, price: null }));
    expect(meta.onlySocialsId).toBeNull();
    expect(meta.postSchedule).toBeNull();
    expect(meta.price).toBeNull();
  });
});
