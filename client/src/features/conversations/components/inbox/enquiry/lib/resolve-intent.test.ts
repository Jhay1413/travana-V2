import { describe, expect, it } from "vitest";
import type { EnquiryIntent } from "../../../../api/ai-enquiry.api";
import { resolveIntent, type IntentLookups } from "./resolve-intent";

const lk: IntentLookups = {
  packageTypes: [
    { id: "pt1", name: "Package Holiday" },
    { id: "pt2", name: "Hot Tub Break" },
  ],
  countries: [
    { id: "c1", country_name: "Spain", country_code: "ES" },
    { id: "c2", country_name: "Greece", country_code: "GR" },
  ],
  destinations: [
    { id: "d1", name: "Lanzarote", type: null, country_id: "c1" },
    { id: "d2", name: "Crete", type: null, country_id: "c2" },
  ],
  boardBasis: [
    { id: "b1", type: "All Inclusive" },
    { id: "b2", type: "Half Board" },
  ],
  airports: [
    { id: "a1", airport_name: "Newcastle", airport_code: "NCL", country_id: "uk", createdAt: "" },
    { id: "a2", airport_name: "Manchester", airport_code: "MAN", country_id: "uk", createdAt: "" },
  ],
};

const intent = (over: Partial<EnquiryIntent> = {}): EnquiryIntent => ({
  enquiryTitle: "",
  holidayType: "",
  countries: [],
  destinations: [],
  resorts: [],
  departureAirports: [],
  boardBasis: [],
  starRating: "",
  travelDate: "",
  flexibility: "",
  nights: null,
  adults: 0,
  children: 0,
  infants: 0,
  childAges: [],
  budget: "",
  budgetType: "",
  notes: "",
  confidence: "high",
  ...over,
});

const ctx = { leadSource: "WHATSAPP" as const };

describe("resolveIntent", () => {
  it("defaults an empty or missing intent to Package Holiday with no intent flag", () => {
    for (const i of [null, intent()]) {
      const r = resolveIntent(i, lk, ctx);
      expect(r.hasIntent).toBe(false);
      expect(r.form.holidayType).toBe("pt1");
      expect(r.form.leadSource).toBe("WHATSAPP");
      expect(r.form.adults).toBe(2);
      expect(r.form.nights).toBe(7);
      expect(Object.values(r.sources).every((s) => s === "set")).toBe(true);
    }
  });

  it("matches names to ids and marks them from chat", () => {
    const r = resolveIntent(
      intent({
        holidayType: "hot tub",
        destinations: ["lanzarote"],
        departureAirports: ["NCL"],
        boardBasis: ["all inclusive"],
        starRating: "4 star",
        flexibility: "+/- 3 days",
        travelDate: "2026-07-01",
        nights: 10,
        adults: 3,
        children: 1,
        childAges: [7],
      }),
      lk,
      ctx,
    );
    expect(r.hasIntent).toBe(true);
    expect(r.form).toMatchObject({
      holidayType: "pt2",
      holidayTypeName: "Hot Tub Break",
      destinations: ["d1"],
      countries: ["c1"],
      airports: ["a1"],
      boardBasis: ["b1"],
      starRating: "4 Star",
      flexibility: "+/- 3 Days",
      nights: 10,
      adults: 3,
      children: 1,
      childAges: [7],
    });
    expect(r.form.labels.d1).toBe("Lanzarote, Spain");
    expect(r.sources).toMatchObject({
      holidayType: "chat",
      destinations: "chat",
      airports: "chat",
      boardBasis: "chat",
      starRating: "chat",
      travelDate: "chat",
      nights: "chat",
      travellers: "chat",
      leadSource: "set",
    });
  });

  it("matches airports by code or name and destinations loosely", () => {
    const r = resolveIntent(intent({ destinations: ["Lanzarote island"], departureAirports: ["manchester airport"] }), lk, ctx);
    expect(r.form.destinations).toEqual(["d1"]);
    expect(r.form.airports).toEqual([]); // "manchester airport" is not contained in "manchester"
    const r2 = resolveIntent(intent({ departureAirports: ["man"] }), lk, ctx);
    expect(r2.form.airports).toEqual(["a2"]);
  });

  it("appends unmatched names to the notes and flags the field to check", () => {
    const r = resolveIntent(
      intent({ destinations: ["Atlantis"], resorts: ["Costa Teguise"], boardBasis: ["Gruel"], notes: "Kids club" }),
      lk,
      ctx,
    );
    expect(r.form.destinations).toEqual([]);
    expect(r.form.notes).toBe(
      "Kids club\n\nTo confirm manually: Destination: Atlantis; Board basis: Gruel; Resort: Costa Teguise",
    );
    expect(r.sources).toMatchObject({ destinations: "check", boardBasis: "check", resorts: "check", notes: "chat" });
  });

  it("marks notes as check when they only hold the unmatched names", () => {
    const r = resolveIntent(intent({ resorts: ["Costa Teguise"] }), lk, ctx);
    expect(r.sources.notes).toBe("check");
  });

  it("downgrades every chat field to check when confidence is low", () => {
    const r = resolveIntent(intent({ destinations: ["Crete"], adults: 2, confidence: "low" }), lk, ctx);
    expect(r.sources.destinations).toBe("check");
    expect(r.sources.travellers).toBe("check");
    expect(r.sources.leadSource).toBe("set");
  });

  it("uses the AI title, else auto-titles from the first destination", () => {
    const ai = resolveIntent(intent({ enquiryTitle: "Greek week", destinations: ["Crete"] }), lk, ctx);
    expect(ai.form.title).toBe("Greek week");
    expect(ai.sources.title).toBe("chat");
    expect(ai.titleIsAuto).toBe(false);

    const auto = resolveIntent(intent({ destinations: ["Crete"] }), lk, ctx);
    expect(auto.form.title).toBe("Crete holiday");
    expect(auto.sources.title).toBe("set");
    expect(auto.titleIsAuto).toBe(true);
  });

  it("keeps the child ages the same length as the children", () => {
    const r = resolveIntent(intent({ children: 2, childAges: [5], adults: 2 }), lk, ctx);
    expect(r.form.childAges).toEqual([5, 0]);
  });

  it("clamps nights above the maximum, flags them and keeps the original in notes", () => {
    const r = resolveIntent(intent({ nights: 28 }), lk, ctx);
    expect(r.form.nights).toBe(21);
    expect(r.sources.nights).toBe("check");
    expect(r.form.notes).toContain("Nights: 28");
  });

  it("accepts only ISO travel dates", () => {
    const ok = resolveIntent(intent({ travelDate: "2026-07-01" }), lk, ctx);
    expect(ok.form.travelDate).toBe("2026-07-01");
    expect(ok.sources.travelDate).toBe("chat");
    const bad = resolveIntent(intent({ travelDate: "next July" }), lk, ctx);
    expect(bad.form.travelDate).toBe("");
    expect(bad.sources.travelDate).toBe("check");
    expect(bad.form.notes).toContain("Travel date: next July");
  });

  it("lists an unmatched holiday type under To confirm manually", () => {
    const r = resolveIntent(intent({ holidayType: "safari", destinations: ["Crete"] }), lk, ctx);
    expect(r.sources.holidayType).toBe("check");
    expect(r.form.notes).toContain("Holiday type: safari");
  });
});
