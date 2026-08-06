import { describe, expect, it } from "vitest";
import { pickDealMatch, seedSlotsFromDeal } from "./deal-context.service";
import type { EnquirySlots, RetrievedDealContext, RetrievedMatch } from "../ai-conversation/ai-conversation.types";

function match(
  distance: number,
  meta: Record<string, unknown> | null = {
    travelDealId: "deal-1",
    quoteId: "quote-1",
    title: "All Inclusive Tunisia",
    postSchedule: "2026-08-01T09:00:00.000Z",
  },
): RetrievedMatch {
  return { sourceId: String(meta?.travelDealId ?? "x"), content: "…", metadata: meta, distance };
}

describe("pickDealMatch", () => {
  it("returns null for no matches or matches with unusable metadata", () => {
    expect(pickDealMatch([])).toBeNull();
    expect(pickDealMatch([match(0.1, null)])).toBeNull();
    expect(pickDealMatch([match(0.1, { title: "no ids" })])).toBeNull();
  });

  it("pins the closest match with source=vector and its distance recorded", () => {
    const picked = pickDealMatch([
      match(0.3, { travelDealId: "far", quoteId: "q-far", title: "Far", postSchedule: "2026-08-01T00:00:00Z" }),
      match(0.1, { travelDealId: "near", quoteId: "q-near", title: "Near", postSchedule: "2026-01-01T00:00:00Z" }),
    ]);
    expect(picked).toMatchObject({
      travelDealId: "near",
      quoteId: "q-near",
      title: "Near",
      source: "vector",
      distance: 0.1,
    });
  });

  it("resolves a near-tie (within 0.03) by the most recently posted deal", () => {
    const picked = pickDealMatch([
      // Marginally closer but posted months earlier…
      match(0.2, { travelDealId: "old", quoteId: "q-old", title: "Old post", postSchedule: "2026-02-01T00:00:00Z" }),
      // …loses to the fresher post the customer more plausibly just saw.
      match(0.22, { travelDealId: "fresh", quoteId: "q-fresh", title: "Fresh post", postSchedule: "2026-08-01T00:00:00Z" }),
    ]);
    expect(picked?.travelDealId).toBe("fresh");
  });

  it("does NOT let recency override a clearly closer match (outside the tie window)", () => {
    const picked = pickDealMatch([
      match(0.1, { travelDealId: "close", quoteId: "q-close", title: "Close", postSchedule: "2026-01-01T00:00:00Z" }),
      match(0.3, { travelDealId: "recent", quoteId: "q-recent", title: "Recent", postSchedule: "2026-08-01T00:00:00Z" }),
    ]);
    expect(picked?.travelDealId).toBe("close");
  });

  it("treats a missing/invalid postSchedule as oldest in a near-tie", () => {
    const picked = pickDealMatch([
      match(0.2, { travelDealId: "undated", quoteId: "q-u", title: "Undated" }),
      match(0.21, { travelDealId: "dated", quoteId: "q-d", title: "Dated", postSchedule: "2026-08-01T00:00:00Z" }),
    ]);
    expect(picked?.travelDealId).toBe("dated");
  });
});

describe("seedSlotsFromDeal", () => {
  const deal: RetrievedDealContext = {
    title: "Spring Time in Rome",
    travelDate: "2027-04-12",
    nights: 4,
    boardBasis: "Bed and Breakfast",
    departureAirport: "Newcastle",
    price: "from £299.00 per person",
    hotelName: "Hotel Roma Centrale",
    resort: "Rome City Centre",
    destination: "Rome",
    country: "Italy",
  };

  it("fills blank slots with the deal's facts, including a notes line naming the deal", () => {
    const slots: EnquirySlots = {};
    seedSlotsFromDeal(slots, deal);
    expect(slots).toMatchObject({
      enquiryTitle: "Spring Time in Rome",
      destinations: ["Rome"],
      resorts: ["Rome City Centre"],
      countries: ["Italy"],
      travelDate: "2027-04-12",
      nights: 4,
      boardBasis: ["Bed and Breakfast"],
      departureAirports: ["Newcastle"],
    });
    expect(slots.notes).toBe(
      'From our Facebook deal post "Spring Time in Rome" (hotel: Hotel Roma Centrale, posted price from £299.00 per person).',
    );
  });

  it("never overwrites what the customer stated themselves", () => {
    const slots: EnquirySlots = { nights: 7, travelDate: "2027-05-01", departureAirports: ["Manchester"] };
    seedSlotsFromDeal(slots, deal);
    expect(slots.nights).toBe(7);
    expect(slots.travelDate).toBe("2027-05-01");
    expect(slots.departureAirports).toEqual(["Manchester"]);
    // Blank fields still get seeded alongside.
    expect(slots.destinations).toEqual(["Rome"]);
  });

  it("is idempotent — re-seeding on every turn never duplicates the notes line", () => {
    const slots: EnquirySlots = { notes: "wants a quiet hotel" };
    seedSlotsFromDeal(slots, deal);
    seedSlotsFromDeal(slots, deal);
    const occurrences = slots.notes?.split("From our Facebook deal post").length ?? 0;
    expect(occurrences - 1).toBe(1);
    expect(slots.notes?.startsWith("wants a quiet hotel")).toBe(true);
  });

  it("skips absent deal fields without writing empties", () => {
    const slots: EnquirySlots = {};
    seedSlotsFromDeal(slots, { title: "Bare Deal" });
    expect(slots.destinations).toBeUndefined();
    expect(slots.travelDate).toBeUndefined();
    expect(slots.nights).toBeUndefined();
    expect(slots.enquiryTitle).toBe("Bare Deal");
    expect(slots.notes).toBe('From our Facebook deal post "Bare Deal".');
  });
});
