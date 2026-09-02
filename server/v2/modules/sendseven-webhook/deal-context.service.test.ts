import { describe, expect, it } from "vitest";
import {
  hasPostReferenceSignal,
  explicitDatesIn,
  isAffirmative,
  mentionsExternalSource,
  pickDealCandidates,
  pickDealMatch,
  pickDeterministicDealMatch,
  seedSlotsFromDeal,
  unseedSlotsFromDeal,
} from "./deal-context.service";
import type { EnquirySlots, RetrievedDealContext, RetrievedMatch } from "../ai-conversation/ai-conversation.types";

// Minimal wording that marks the customer as referring to something they SAW,
// which similarity-based pinning now requires.
const SAW_POST = "saw your post";

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
    ], SAW_POST);
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
    ], SAW_POST);
    expect(picked?.travelDealId).toBe("fresh");
  });

  it("does NOT let recency override a clearly closer match (outside the tie window)", () => {
    const picked = pickDealMatch([
      match(0.1, { travelDealId: "close", quoteId: "q-close", title: "Close", postSchedule: "2026-01-01T00:00:00Z" }),
      match(0.3, { travelDealId: "recent", quoteId: "q-recent", title: "Recent", postSchedule: "2026-08-01T00:00:00Z" }),
    ], SAW_POST);
    expect(picked?.travelDealId).toBe("close");
  });

  it("treats a missing/invalid postSchedule as oldest in a near-tie", () => {
    const picked = pickDealMatch([
      match(0.2, { travelDealId: "undated", quoteId: "q-u", title: "Undated" }),
      match(0.21, { travelDealId: "dated", quoteId: "q-d", title: "Dated", postSchedule: "2026-08-01T00:00:00Z" }),
    ], SAW_POST);
    expect(picked?.travelDealId).toBe("dated");
  });

  it("refuses to pin matches beyond the strict cutoff (candidate-band matches from the wider retrieval)", () => {
    expect(pickDealMatch([match(0.45), match(0.55)], SAW_POST)).toBeNull();
    // A strict-band match still pins even when candidate-band noise rides along.
    expect(pickDealMatch([match(0.55), match(0.3)], SAW_POST)?.distance).toBe(0.3);
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

  it("field rescue: pins on the deal's exact travel date when the message references a post", () => {
    const matches = [
      match(0.443, { travelDealId: "late", quoteId: "q-l", title: "Late Rome Deal", travelDate: "2026-11-20" }),
      match(0.461, { travelDealId: "spring", quoteId: "q-s", title: "Spring Rome", travelDate: "2027-04-12" }),
    ];
    // Vision-extracted screenshot text (mentions "image") and a human "saw the post" both qualify.
    expect(
      pickDealMatch(matches, "details from the image i've sent: travel date: 12 april 2027, price: £369")?.travelDealId,
    ).toBe("spring");
    expect(pickDealMatch(matches, "saw the one on the 12th april, is it still on?")?.travelDealId).toBe("spring");
  });

  it("field rescue: does NOT pin on a date alone when the customer never mentions a post", () => {
    const matches = [
      match(0.45, { travelDealId: "spring", quoteId: "q-s", title: "Spring Rome", travelDate: "2027-04-12" }),
    ];
    // A plain enquiry that happens to share the deal's travel date must not
    // start quoting that deal's hotel/price at the customer.
    expect(pickDealMatch(matches, "can you do rome for us on 12 april, 5 nights?")).toBeNull();
  });

  it("field rescue: pins on the posted price only alongside a post reference", () => {
    const matches = [
      match(0.45, { travelDealId: "a", quoteId: "qa", title: "Deal A", price: "369.00" }),
      match(0.46, { travelDealId: "b", quoteId: "qb", title: "Deal B", price: "249.00" }),
    ];
    expect(pickDealMatch(matches, "the advert said £369 per person i think")?.travelDealId).toBe("a");
    // A bare budget figure is not evidence they saw a post.
    expect(pickDealMatch(matches, "our budget is about 369 each")).toBeNull();
    // Digit-boundary guard: price digits inside a phone number must not hit.
    expect(pickDealMatch(matches, "saw your post — jhon, 0913692084")).toBeNull();
  });

  it("hotel rescue needs no post reference — a hotel name is never said by accident", () => {
    const matches = [
      match(0.5, { travelDealId: "spring", quoteId: "q-s", title: "Spring Rome", hotelName: "Hotel Taormina" }),
    ];
    expect(pickDealMatch(matches, "is the taormina still available?")?.travelDealId).toBe("spring");
  });

  it("field rescue: stays ambiguous when both deals share the matching fact", () => {
    const matches = [
      match(0.45, { travelDealId: "a", quoteId: "qa", title: "Deal A", travelDate: "2027-04-12" }),
      match(0.46, { travelDealId: "b", quoteId: "qb", title: "Deal B", travelDate: "2027-04-12" }),
    ];
    expect(pickDealMatch(matches, "the 12th april one")).toBeNull();
  });

  it("pickDeterministicDealMatch returns only identified matches, never a distance guess", () => {
    // Well inside the pin cutoff, but nothing identifying in the text.
    const close = [match(0.1, { travelDealId: "a", quoteId: "qa", title: "Spring Time in Rome" })];
    // Similarity pins only alongside a post reference (see the gate tests
    // below); on its own "hi there" identifies nothing.
    expect(pickDealMatch(close, `${SAW_POST} hi there`)?.travelDealId).toBe("a");
    expect(pickDealMatch(close, "hi there")).toBeNull();
    expect(pickDeterministicDealMatch(close, "hi there")).toBeNull();
    // Named outright → deterministic.
    expect(pickDeterministicDealMatch(close, "the spring time in rome one")?.travelDealId).toBe("a");
  });

  it("field rescue: pins on the hotel name, including without the 'Hotel' prefix", () => {
    // Real observed failure: "the hotel was taormina" identified nothing.
    const matches = [
      match(0.478, { travelDealId: "late", quoteId: "q-l", title: "Late Rome Deal", hotelName: "Hotel Colosseum" }),
      match(0.524, { travelDealId: "spring", quoteId: "q-s", title: "Spring Time in Rome", hotelName: "Hotel Taormina" }),
    ];
    expect(pickDealMatch(matches, "i only remembered the hotel was taormina and its for rome")?.travelDealId).toBe(
      "spring",
    );
    expect(pickDealMatch(matches, "it was at the hotel colosseum")?.travelDealId).toBe("late");
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

  it("reports the keys it seeded, so a re-pin can undo exactly those", () => {
    const slots: EnquirySlots = { nights: 7 };
    const seeded = seedSlotsFromDeal(slots, deal);
    // nights was the customer's own — not seeded, so never un-seeded later.
    expect(seeded).not.toContain("nights");
    expect(seeded).toEqual(
      expect.arrayContaining(["enquiryTitle", "destinations", "travelDate", "departureAirports", "boardBasis"]),
    );
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

describe("mentionsExternalSource (another operator's advert)", () => {
  it("detects a named competitor as the source of the deal", () => {
    expect(mentionsExternalSource("i saw a deal on TUI for tenerife")).toBe(true);
    expect(mentionsExternalSource("saw this on jet2 last night")).toBe(true);
    expect(mentionsExternalSource("found it on loveholidays, can you match it?")).toBe(true);
    expect(mentionsExternalSource("source: TUI. destination: Rome. price: £399")).toBe(true);
  });

  it("handles the real price-match case, text and screenshot alike", () => {
    expect(mentionsExternalSource("hiya can you beat quotes from first choice?x")).toBe(true);
    // A screenshot's footer carries the bare domain, not the spaced brand name.
    expect(
      mentionsExternalSource("title: SunClub Salou. source: firstchoice.co.uk. price: £266pp. 3 nights"),
    ).toBe(true);
    expect(mentionsExternalSource("found this on loveholidays.com")).toBe(true);
  });

  it("catches a beat/match request even when the brand is misspelt", () => {
    // Real message: both "beat" and "TUI" typo'd — brand-spotting alone fails,
    // but asking us to beat a quote is itself proof it isn't ours.
    expect(mentionsExternalSource("can you bet this one from tin?")).toBe(true);
    expect(mentionsExternalSource("can you beat this?")).toBe(true);
    expect(mentionsExternalSource("any chance you can match that quote")).toBe(true);
    expect(mentionsExternalSource("do you price match?")).toBe(true);
  });

  it("does not treat a discount request on OUR OWN deal as external", () => {
    expect(mentionsExternalSource("saw your rome post — can you beat £369?")).toBe(false);
  });

  it("ignores 'bet' used as an ordinary word", () => {
    expect(mentionsExternalSource("i bet that sells out fast!")).toBe(false);
    expect(mentionsExternalSource("you bet")).toBe(false);
  });

  it("does NOT fire when they are clearly talking about OUR post", () => {
    // We sell these operators, so the brand alone means nothing.
    expect(mentionsExternalSource("is your TUI deal still available?")).toBe(false);
    expect(mentionsExternalSource("saw your post — is it a jet2 flight?")).toBe(false);
  });

  it("stays quiet for ordinary messages", () => {
    expect(mentionsExternalSource("saw your rome post, can you do other dates?")).toBe(false);
    expect(mentionsExternalSource("")).toBe(false);
  });
});

describe("unseedSlotsFromDeal (correcting a wrong pin)", () => {
  const wrongDeal: RetrievedDealContext = {
    title: "Late Rome Deal",
    travelDate: "2026-11-20",
    nights: 3,
    departureAirport: "Gatwick",
    destination: "Rome",
    hotelName: "Hotel Colosseum",
    price: "from £199.00 per person",
  };

  it("removes exactly what that deal seeded, leaving the customer's own answers", () => {
    const slots: EnquirySlots = { adults: 4, notes: "wants a quiet hotel" };
    const seededKeys = seedSlotsFromDeal(slots, wrongDeal);
    expect(slots.travelDate).toBe("2026-11-20");

    unseedSlotsFromDeal(slots, {
      travelDealId: "late",
      quoteId: "q-l",
      title: wrongDeal.title,
      source: "vector",
      matchedAt: "2026-08-06T00:00:00.000Z",
      seededKeys,
    });

    expect(slots.travelDate).toBeUndefined();
    expect(slots.nights).toBeUndefined();
    expect(slots.departureAirports).toBeUndefined();
    expect(slots.enquiryTitle).toBeUndefined();
    // Customer-stated values and their own note survive.
    expect(slots.adults).toBe(4);
    expect(slots.notes).toBe("wants a quiet hotel");
  });

  it("drops only the old deal's Post reference block, keeping any other blocks", () => {
    const slots: EnquirySlots = {};
    const seededKeys = seedSlotsFromDeal(slots, wrongDeal);
    slots.notes = `${slots.notes}\n\nSomething else the agent needs`;

    unseedSlotsFromDeal(slots, {
      travelDealId: "late",
      quoteId: "q-l",
      title: wrongDeal.title,
      source: "vector",
      matchedAt: "2026-08-06T00:00:00.000Z",
      seededKeys,
    });

    expect(slots.notes).toBe("Something else the agent needs");
    expect(slots.notes).not.toContain("Late Rome Deal");
  });

  it("leaves the corrected deal free to seed its own values afterwards", () => {
    const slots: EnquirySlots = {};
    const seededKeys = seedSlotsFromDeal(slots, wrongDeal);
    unseedSlotsFromDeal(slots, {
      travelDealId: "late",
      quoteId: "q-l",
      title: wrongDeal.title,
      source: "vector",
      matchedAt: "2026-08-06T00:00:00.000Z",
      seededKeys,
    });
    seedSlotsFromDeal(slots, {
      title: "Spring Time in Rome",
      travelDate: "2027-04-12",
      nights: 4,
      departureAirport: "Newcastle",
      hotelName: "Hotel Taormina",
    });

    expect(slots.travelDate).toBe("2027-04-12");
    expect(slots.nights).toBe(4);
    expect(slots.departureAirports).toEqual(["Newcastle"]);
    expect(slots.notes).toContain('Post reference: "Spring Time in Rome"');
    expect(slots.notes).not.toContain("Late Rome Deal");
  });
});

// Sibling-post confusion — the Kos/Crete incident. A screenshot of our
// "ALL INCLUSIVE IN GREECE — Wed 14 Oct 2026 — £742.50pp" Kos post pinned a
// DIFFERENT Greek all-inclusive deal (Crete, Apr 2027, £861pp) purely on
// similarity, and the bot then quoted that hotel and price to the customer.
describe("explicitDatesIn", () => {
  it("reads dated facts a screenshot carries, in every common shape", () => {
    expect([...explicitDatesIn("Wed 14 Oct 2026")]).toEqual(["2026-10-14"]);
    expect([...explicitDatesIn("departs 14/10/2026")]).toEqual(["2026-10-14"]);
    expect([...explicitDatesIn("2026-10-14")]).toEqual(["2026-10-14"]);
    expect([...explicitDatesIn("14th October 2026")]).toEqual(["2026-10-14"]);
    expect([...explicitDatesIn("October 14, 2026")]).toEqual(["2026-10-14"]);
  });

  it("ignores a date with no year — that's usually the customer's own preference", () => {
    expect(explicitDatesIn("can we go 12 April instead?").size).toBe(0);
    expect(explicitDatesIn("sometime in october").size).toBe(0);
  });

  it("ignores impossible dates", () => {
    expect(explicitDatesIn("31/02/2026").size).toBe(0);
  });
});

describe("pickDealMatch — sibling posts ruled out by the customer's dated facts", () => {
  const dealMatch = (over: Record<string, unknown>, distance: number) => ({
    sourceId: String(over.travelDealId),
    content: "",
    distance,
    metadata: { quoteId: "q1", ...over },
  });

  it("does NOT pin a similar deal whose travel date the screenshot contradicts", () => {
    const query = "saw this posted on your facebook, can you give me more info please. ALL INCLUSIVE IN GREECE, Wed 14 Oct 2026, 7 nights, Newcastle, from £742.50pp";
    const crete = dealMatch({ travelDealId: "d-crete", title: "Holiday Deal", travelDate: "2027-04-09", price: "861.00", hotelName: "Stella Blue Seaside Resort" }, 0.28);

    expect(pickDealMatch([crete], query)).toBeNull();
    // …and it isn't offered as a "was it this one?" candidate either.
    expect(pickDealCandidates([crete], 3, query)).toEqual([]);
  });

  it("still pins the deal whose date the screenshot MATCHES", () => {
    const query = "saw this on your facebook — ALL INCLUSIVE IN GREECE, Wed 14 Oct 2026, from £742.50pp";
    const kos = dealMatch({ travelDealId: "d-kos", title: "Greece Beachfront", travelDate: "2026-10-14", price: "742.50" }, 0.30);
    const crete = dealMatch({ travelDealId: "d-crete", title: "Holiday Deal", travelDate: "2027-04-09", price: "861.00" }, 0.26);

    // Crete is the CLOSER vector match, but its date is ruled out.
    expect(pickDealMatch([kos, crete], query)?.travelDealId).toBe("d-kos");
  });

  it("leaves ordinary (undated) mentions pinning exactly as before", () => {
    const query = "saw your all inclusive greece deal on facebook, any info?";
    const crete = dealMatch({ travelDealId: "d-crete", title: "Holiday Deal", travelDate: "2027-04-09" }, 0.28);

    expect(pickDealMatch([crete], query)?.travelDealId).toBe("d-crete");
  });

  it("a verbatim hotel name still wins over a date mismatch (stronger evidence)", () => {
    const query = "is the Stella Blue Seaside Resort one still available for 14/10/2026?";
    const crete = dealMatch({ travelDealId: "d-crete", title: "Holiday Deal", travelDate: "2027-04-09", hotelName: "Stella Blue Seaside Resort" }, 0.55);

    expect(pickDealMatch([crete], query)?.travelDealId).toBe("d-crete");
  });
});

// A plain enquiry is not a post reference. Naming a destination we happen to
// advertise must not attach that advert — observed: "Looking for a holiday to
// Albufeira next August" pinned our "Albufeira Summer Break" post and stamped
// its June flight date onto an August enquiry.
describe("pickDealMatch — similarity requires the customer to have referenced a post", () => {
  const albufeira = (distance: number) => ({
    sourceId: "d-alb",
    content: "",
    distance,
    metadata: {
      travelDealId: "d-alb",
      quoteId: "q-alb",
      title: "Albufeira Summer Break",
      travelDate: "2026-06-11",
      price: "439.00",
      hotelName: "Cerro Mar Colina",
      postSchedule: "2026-05-01T09:00:00.000Z",
    },
  });

  it("does NOT pin when the customer merely says where they want to go", () => {
    expect(pickDealMatch([albufeira(0.2)], "Looking for a holiday to Albufeira next August near a beach please")).toBeNull();
  });

  it("pins once they reference a post/advert/image", () => {
    expect(pickDealMatch([albufeira(0.2)], "saw your Albufeira post, any info?")?.travelDealId).toBe("d-alb");
    expect(pickDealMatch([albufeira(0.2)], "is this deal on the picture I sent still available?")?.travelDealId).toBe("d-alb");
  });

  it("still pins on a verbatim hotel name with no post wording at all", () => {
    // Deterministic evidence — they named the hotel, so they mean that deal.
    expect(pickDealMatch([albufeira(0.55)], "can you price up Cerro Mar Colina for me")?.travelDealId).toBe("d-alb");
  });

  it("still pins on a verbatim deal title with no post wording at all", () => {
    expect(pickDealMatch([albufeira(0.55)], "how much is the albufeira summer break")?.travelDealId).toBe("d-alb");
  });
});

// Customers don't quote titles. Our "Xmas in Amsterdam" post was asked about as
// "the Amsterdam Christmas deal" — every meaningful word shared, no substring
// match — so the correct deal was never identified and similarity picked a
// DIFFERENT Amsterdam post, whose hotel the bot then named.
describe("pickDealMatch — titles recognised from the customer's own wording", () => {
  const deal = (id: string, title: string, distance: number) => ({
    sourceId: id,
    content: "",
    distance,
    metadata: { travelDealId: id, quoteId: `q-${id}`, title, postSchedule: "2026-08-01T09:00:00.000Z" },
  });

  it("matches a title whose words all appear, in any order, with xmas = christmas", () => {
    const xmas = deal("d-xmas", "Xmas in Amsterdam", 0.55);
    const city = deal("d-city", "Amsterdam City Sightseeing", 0.20);

    // The city break is the CLOSER vector match, but the words identify the other.
    expect(pickDealMatch([xmas, city], "which hotel is the Amsterdam Christmas deal for please")?.travelDealId).toBe("d-xmas");
  });

  it("still works when the customer writes the title back exactly", () => {
    const xmas = deal("d-xmas", "Xmas in Amsterdam", 0.5);
    expect(pickDealMatch([xmas], "saw your Xmas in Amsterdam post")?.travelDealId).toBe("d-xmas");
  });

  it("does NOT identify a deal from the destination alone", () => {
    // "Amsterdam" is one distinctive word — matching on it would claim every
    // Amsterdam message, which is the wrong-deal bug itself.
    const bare = deal("d-ams", "Amsterdam", 0.5);
    expect(pickDealMatch([bare], "anything for amsterdam?")).toBeNull();
  });

  it("stays ambiguous when two posts share every distinctive word", () => {
    const a = deal("d-a", "Amsterdam Christmas Markets", 0.4);
    const b = deal("d-b", "Christmas Markets Amsterdam", 0.41);
    expect(pickDealMatch([a, b], "the amsterdam christmas markets one")).toBeNull();
  });

  it("does not match a title that only partly overlaps", () => {
    const greece = deal("d-greece", "All Inclusive in Greece", 0.5);
    // "greece" alone is not enough — "all inclusive" is missing.
    expect(pickDealMatch([greece], "anything in greece?")).toBeNull();
  });
});

// A similarity guess is not a certainty. Both wrong-deal incidents (a Kos
// screenshot matched to a Crete post; "the Amsterdam Christmas deal" matched to
// a different Amsterdam one) came from treating a guess as fact, so a guessed
// deal is now marked for confirmation and only a match to something the
// customer actually said may be spoken about outright.
describe("pickDealMatch — how the deal was identified", () => {
  const deal = (id: string, meta: Record<string, unknown>, distance: number) => ({
    sourceId: id,
    content: "",
    distance,
    metadata: { travelDealId: id, quoteId: `q-${id}`, postSchedule: "2026-08-01T09:00:00.000Z", ...meta },
  });

  it("marks a title match as identified, not guessed", () => {
    const d = deal("d-xmas", { title: "Xmas in Amsterdam" }, 0.5);
    expect(pickDealMatch([d], "the Amsterdam Christmas deal")?.source).toBe("marker");
  });

  it("marks a hotel-name match as identified", () => {
    const d = deal("d-1", { title: "Winter Sun", hotelName: "Hotel Taormina" }, 0.5);
    expect(pickDealMatch([d], "is the taormina still available?")?.source).toBe("marker");
  });

  it("marks a distance-only match as a guess", () => {
    const d = deal("d-1", { title: "Winter Sun in Spain" }, 0.2);
    expect(pickDealMatch([d], "saw your post about spain, any details?")?.source).toBe("vector");
  });
});

describe("isAffirmative", () => {
  it("accepts the ways customers confirm", () => {
    for (const t of ["yes", "Yes please", "yeah that's the one", "that's it", "correct", "yep", "ok"]) {
      expect(isAffirmative(t), t).toBe(true);
    }
  });

  it("does not mistake other replies for confirmation", () => {
    for (const t of ["no not that one", "Yesterday I saw it", "the other one", "how much is it?", ""]) {
      expect(isAffirmative(t), t).toBe(false);
    }
  });
});

// LIVE FAILURE. "Hiya are u doing deals for ac Milan flights and hotels?" read
// as a reference to one of our posts — purely because of the bare word "deals"
// — which let similarity pin an unrelated Marhaba Royal deal and name it back
// to the customer. This gate is the only thing standing between "I want to go
// to X" and "I saw your X deal", so its negatives matter more than its
// positives.
describe("hasPostReferenceSignal — generic commercial words are not evidence", () => {
  it("does not fire on ordinary ways of asking what an agency sells", () => {
    for (const t of [
      "Hiya are u doing deals for ac Milan flights and hotels?",
      "do you do deals for tenerife",
      "have you got any offers for spain in september",
      "any deals for Spain in September",
      "whats your best price for tenerife in october",
      "looking for a holiday to Albufeira next August near a beach please",
    ]) {
      expect(hasPostReferenceSignal(t)).toBe(false);
    }
  });

  it("still fires when they actually point at a post", () => {
    for (const t of [
      "saw this on your facebook",
      "is this deal still available",
      "your deal looked good",
      "the deal you posted yesterday",
      "spotted your advert",
      "I saw your post about kos",
      "sending you a screenshot",
      // The image-details note the worker injects for a screenshot they sent.
      "[Details from the image(s) I've sent in this chat]",
    ]) {
      expect(hasPostReferenceSignal(t)).toBe(true);
    }
  });
});
