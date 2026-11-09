import { describe, expect, it } from "vitest";
import {
  holidayKindFromName,
  quoteSectionState,
  quoteSectionsFor,
  sectionsDone,
  type QuoteHolidayKind,
  type QuoteSectionInputs,
} from "./quote-form-sections";

const keys = (kind: QuoteHolidayKind, cruiseOnly = false) => quoteSectionsFor(kind, { cruiseOnly }).map((s) => s.key);

const empty: QuoteSectionInputs = { imageCount: 0, extrasCount: 0, tagCount: 0 };

describe("holidayKindFromName", () => {
  it("maps the lookup names", () => {
    expect(holidayKindFromName("Hot Tub Break")).toBe("hot-tub");
    expect(holidayKindFromName("Cruise Package")).toBe("cruise");
    expect(holidayKindFromName("Package Holiday")).toBe("package");
    expect(holidayKindFromName(undefined)).toBe("package");
  });
});

describe("quoteSectionsFor", () => {
  it("package holiday", () => {
    expect(keys("package")).toEqual(["overview", "travel", "hotel", "flights", "extras", "images", "costings", "tags"]);
  });
  it("hot tub break has a lodge and no flights", () => {
    expect(keys("hot-tub")).toEqual(["overview", "travel", "lodge", "extras", "images", "costings", "tags"]);
  });
  it("cruise has cruise details and flights", () => {
    expect(keys("cruise")).toEqual(["overview", "travel", "cruise", "flights", "extras", "images", "costings", "tags"]);
  });
  it("cruise only drops flights", () => {
    expect(keys("cruise", true)).toEqual(["overview", "travel", "cruise", "extras", "images", "costings", "tags"]);
  });
  it("extras and tags are optional, the rest required", () => {
    const optional = quoteSectionsFor("package")
      .filter((s) => s.optional)
      .map((s) => s.key);
    expect(optional).toEqual(["extras", "tags"]);
  });
});

describe("sectionsDone", () => {
  it("is all false for an empty form", () => {
    expect(Object.values(sectionsDone(empty)).some(Boolean)).toBe(false);
  });
  it("overview needs type, title and operator", () => {
    expect(sectionsDone({ ...empty, packageType: "p", quoteTitle: "t" }).overview).toBe(false);
    expect(sectionsDone({ ...empty, packageType: "p", quoteTitle: "t", tourOperatorId: "o" }).overview).toBe(true);
    expect(sectionsDone({ ...empty, packageType: "p", quoteTitle: "  ", tourOperatorId: "o" }).overview).toBe(false);
  });
  it("travel needs date, nights and an adult", () => {
    expect(sectionsDone({ ...empty, travelDate: "2026-12-01", nights: 7, passengersAdults: 2 }).travel).toBe(true);
    expect(sectionsDone({ ...empty, travelDate: "2026-12-01", nights: 0, passengersAdults: 2 }).travel).toBe(false);
    expect(sectionsDone({ ...empty, travelDate: "2026-12-01", nights: "7", passengersAdults: 0 }).travel).toBe(false);
  });
  it("hotel, lodge and cruise", () => {
    expect(sectionsDone({ ...empty, accommodationId: "a" }).hotel).toBe(true);
    expect(sectionsDone({ ...empty, parkId: "p" }).lodge).toBe(false);
    expect(sectionsDone({ ...empty, parkId: "p", lodgeId: "l" }).lodge).toBe(true);
    expect(sectionsDone({ ...empty, cruiseLine: "c" }).cruise).toBe(false);
    expect(sectionsDone({ ...empty, cruiseLine: "c", shipName: "s" }).cruise).toBe(true);
  });
  it("flights need both directions", () => {
    const outbound = { outboundDepartAirportId: "a", outboundArriveAirportId: "b", outboundDepartDate: "2026-12-01" };
    expect(sectionsDone({ ...empty, ...outbound }).flights).toBe(false);
    expect(sectionsDone({ ...empty, ...outbound, inboundDepartAirportId: "b", inboundDepartDate: "2026-12-08" }).flights).toBe(true);
  });
  it("images, costings, extras and tags", () => {
    expect(sectionsDone({ ...empty, imageCount: 1 }).images).toBe(true);
    expect(sectionsDone({ ...empty, price: 0 }).costings).toBe(false);
    expect(sectionsDone({ ...empty, price: "1250.5" }).costings).toBe(true);
    expect(sectionsDone({ ...empty, extrasCount: 2 }).extras).toBe(true);
    expect(sectionsDone({ ...empty, tagCount: 1 }).tags).toBe(true);
  });
});

describe("quoteSectionState", () => {
  it("returns visible sections with their done flag", () => {
    const state = quoteSectionState("hot-tub", {}, { ...empty, parkId: "p", lodgeId: "l" });
    expect(state.find((s) => s.key === "lodge")?.done).toBe(true);
    expect(state.find((s) => s.key === "hotel")).toBeUndefined();
  });
});
