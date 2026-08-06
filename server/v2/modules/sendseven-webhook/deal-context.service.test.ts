import { describe, expect, it } from "vitest";
import { pickDealCandidates, pickDealMatch, seedSlotsFromDeal } from "./deal-context.service";
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

  it("refuses to pin matches beyond the strict cutoff (candidate-band matches from the wider retrieval)", () => {
    expect(pickDealMatch([match(0.45), match(0.55)])).toBeNull();
    // A strict-band match still pins even when candidate-band noise rides along.
    expect(pickDealMatch([match(0.55), match(0.3)])?.distance).toBe(0.3);
  });

  it("title rescue: pins the deal whose title appears verbatim in the query, beating distance rank", () => {
    // Real observed failure: the screenshot's true deal ranked BEHIND a sibling.
    const matches = [
      match(0.443, { travelDealId: "late", quoteId: "q-l", title: "Late Rome Deal" }),
      match(0.461, { travelDealId: "spring", quoteId: "q-s", title: "Spring Time in Rome" }),
      match(0.473, { travelDealId: "sunny", quoteId: "q-y", title: "sunny rome" }),
    ];
    const picked = pickDealMatch(matches, "saw this facebook deal, Spring Time in Rome 4 nights, can you do other dates");
    expect(picked?.travelDealId).toBe("spring");
  });

  it("title rescue: stays ambiguous (no pin) when several titles appear in the query", () => {
    const matches = [
      match(0.45, { travelDealId: "a", quoteId: "qa", title: "Spring Time in Rome" }),
      match(0.46, { travelDealId: "b", quoteId: "qb", title: "Late Rome Deal" }),
    ];
    expect(pickDealMatch(matches, "was it spring time in rome or the late rome deal?")).toBeNull();
  });

  it("title rescue: ignores titles too short to be safe substrings", () => {
    const matches = [match(0.5, { travelDealId: "r", quoteId: "qr", title: "rome" })];
    expect(pickDealMatch(matches, "any deals for rome?")).toBeNull();
  });

  it("field rescue: pins on the deal's exact travel date appearing in the text (screenshot fields)", () => {
    const matches = [
      match(0.443, { travelDealId: "late", quoteId: "q-l", title: "Late Rome Deal", travelDate: "2026-11-20" }),
      match(0.461, { travelDealId: "spring", quoteId: "q-s", title: "Spring Rome", travelDate: "2027-04-12" }),
    ];
    // Vision-extracted note style ("travel date: 12 April 2027") and human style both hit.
    expect(pickDealMatch(matches, "title: spring escape. travel date: 12 april 2027. price: £369 per person")?.travelDealId).toBe("spring");
    expect(pickDealMatch(matches, "the one on the 12th april please")?.travelDealId).toBe("spring");
  });

  it("field rescue: pins on the posted price appearing as a standalone number", () => {
    const matches = [
      match(0.45, { travelDealId: "a", quoteId: "qa", title: "Deal A", price: "369.00" }),
      match(0.46, { travelDealId: "b", quoteId: "qb", title: "Deal B", price: "249.00" }),
    ];
    expect(pickDealMatch(matches, "it was £369 per person i think")?.travelDealId).toBe("a");
    // Digit-boundary guard: the price digits inside a phone number must not hit.
    expect(pickDealMatch(matches, "jhon, 0913692084")).toBeNull();
  });

  it("field rescue: stays ambiguous when both deals share the matching fact", () => {
    const matches = [
      match(0.45, { travelDealId: "a", quoteId: "qa", title: "Deal A", travelDate: "2027-04-12" }),
      match(0.46, { travelDealId: "b", quoteId: "qb", title: "Deal B", travelDate: "2027-04-12" }),
    ];
    expect(pickDealMatch(matches, "the 12th april one")).toBeNull();
  });
});

describe("pickDealCandidates", () => {
  it("returns parseable matches closest-first with their display fields", () => {
    const candidates = pickDealCandidates([
      match(0.5, {
        travelDealId: "d2",
        quoteId: "q2",
        title: "Tunisia Half Board",
        travelDate: "2026-11-14",
        nights: 7,
        price: "249.00",
      }),
      match(0.42, {
        travelDealId: "d1",
        quoteId: "q1",
        title: "All Inclusive Tunisia",
        travelDate: "2026-10-29",
        nights: 7,
        price: "299.00",
      }),
      match(0.48, null),
    ]);
    expect(candidates.map((c) => c.title)).toEqual(["All Inclusive Tunisia", "Tunisia Half Board"]);
    expect(candidates[0]).toMatchObject({ travelDate: "2026-10-29", nights: 7, price: "299.00", distance: 0.42 });
  });

  it("dedupes by deal and honours the limit", () => {
    const meta = { travelDealId: "d1", quoteId: "q1", title: "Same Deal" };
    const many = [
      match(0.41, meta),
      match(0.45, meta),
      match(0.42, { travelDealId: "d2", quoteId: "q2", title: "B" }),
      match(0.43, { travelDealId: "d3", quoteId: "q3", title: "C" }),
      match(0.44, { travelDealId: "d4", quoteId: "q4", title: "D" }),
    ];
    const candidates = pickDealCandidates(many, 3);
    expect(candidates).toHaveLength(3);
    expect(new Set(candidates.map((c) => c.title)).size).toBe(3);
  });

  it("returns [] when nothing is parseable", () => {
    expect(pickDealCandidates([])).toEqual([]);
    expect(pickDealCandidates([match(0.5, null)])).toEqual([]);
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
    luggageTransfers: "Included",
    flights: [
      {
        direction: "outbound",
        flightNumber: "LS411",
        from: "Newcastle (NCL)",
        to: "Rome Ciampino (CIA)",
        departs: "2027-04-12T07:05:00.000Z",
        arrives: "2027-04-12T10:40:00.000Z",
      },
    ],
  };

  it("fills blank slots with the deal's facts and writes a structured agent note", () => {
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
    // The note carries ONLY the facts with no slot of their own — hotel,
    // price, flight times, luggage — not the slot-mapped date/nights/board.
    // Dates in UK format.
    expect(slots.notes).toBe(
      [
        'Post reference: "Spring Time in Rome"',
        "• Hotel: Hotel Roma Centrale",
        "• Posted price: from £299.00 per person",
        "• Outbound flight LS411, Newcastle (NCL) → Rome Ciampino (CIA), departs 12/04/2027 07:05, arrives 12/04/2027 10:40",
        "• Luggage & transfers: Included",
      ].join("\n"),
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

  it("is idempotent — re-seeding on every turn never duplicates the notes block", () => {
    const slots: EnquirySlots = { notes: "wants a quiet hotel" };
    seedSlotsFromDeal(slots, deal);
    seedSlotsFromDeal(slots, deal);
    const occurrences = slots.notes?.split("Post reference:").length ?? 0;
    expect(occurrences - 1).toBe(1);
    // Customer wording stays first; the deal block is appended after it.
    expect(slots.notes?.startsWith("wants a quiet hotel")).toBe(true);
  });

  it("skips absent deal fields without writing empties", () => {
    const slots: EnquirySlots = {};
    seedSlotsFromDeal(slots, { title: "Bare Deal" });
    expect(slots.destinations).toBeUndefined();
    expect(slots.travelDate).toBeUndefined();
    expect(slots.nights).toBeUndefined();
    expect(slots.enquiryTitle).toBe("Bare Deal");
    expect(slots.notes).toBe('Post reference: "Bare Deal"');
  });
});
