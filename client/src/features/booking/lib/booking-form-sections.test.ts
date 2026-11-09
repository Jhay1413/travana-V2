import { describe, expect, it } from "vitest";
import {
  bookingSectionState,
  bookingSectionsDone,
  bookingSectionsFor,
  type BookingHolidayKind,
  type BookingSectionInputs,
} from "./booking-form-sections";

const keys = (kind: BookingHolidayKind, opts: { cruiseOnly?: boolean; hasClient?: boolean } = {}) =>
  bookingSectionsFor(kind, opts).map((s) => s.key);

const empty: BookingSectionInputs = { imageCount: 0, extrasCount: 0, tagCount: 0, upsellCount: 0 };

describe("bookingSectionsFor", () => {
  it("package holiday", () => {
    expect(keys("package")).toEqual(["references", "overview", "travel", "hotel", "flights", "extras", "upsells", "images", "costings", "tags"]);
  });
  it("hot tub break has a lodge and no flights", () => {
    expect(keys("hot-tub")).toEqual(["references", "overview", "travel", "lodge", "extras", "upsells", "images", "costings", "tags"]);
  });
  it("cruise has cruise details and flights", () => {
    expect(keys("cruise")).toEqual(["references", "overview", "travel", "cruise", "flights", "extras", "upsells", "images", "costings", "tags"]);
  });
  it("cruise only drops flights", () => {
    expect(keys("cruise", { cruiseOnly: true })).not.toContain("flights");
  });
  it("wallet credit appears after costings only with a client", () => {
    expect(keys("package")).not.toContain("wallet");
    const withClient = keys("package", { hasClient: true });
    expect(withClient.indexOf("wallet")).toBe(withClient.indexOf("costings") + 1);
  });
  it("extras, upsells, wallet and tags are optional", () => {
    const optional = bookingSectionsFor("package", { hasClient: true })
      .filter((s) => s.optional)
      .map((s) => s.key);
    expect(optional).toEqual(["extras", "upsells", "wallet", "tags"]);
  });
});

describe("bookingSectionsDone", () => {
  it("references need both numbers", () => {
    expect(bookingSectionsDone({ ...empty, haysRef: "HAY-1234567" }).references).toBe(false);
    expect(bookingSectionsDone({ ...empty, haysRef: "HAY-1234567", supplierRef: "  " }).references).toBe(false);
    expect(bookingSectionsDone({ ...empty, haysRef: "HAY-1234567", supplierRef: "S1" }).references).toBe(true);
  });
  it("upsells and wallet tick when they have content", () => {
    expect(bookingSectionsDone(empty).upsells).toBe(false);
    expect(bookingSectionsDone({ ...empty, upsellCount: 1 }).upsells).toBe(true);
    expect(bookingSectionsDone({ ...empty, walletCreditAmount: 0 }).wallet).toBe(false);
    expect(bookingSectionsDone({ ...empty, walletCreditAmount: 25 }).wallet).toBe(true);
  });
  it("reuses the quote rules for shared sections", () => {
    const done = bookingSectionsDone({ ...empty, packageType: "p", quoteTitle: "t", tourOperatorId: "o", price: 100, imageCount: 1 });
    expect(done.overview).toBe(true);
    expect(done.costings).toBe(true);
    expect(done.images).toBe(true);
    expect(done.travel).toBe(false);
  });
});

describe("bookingSectionState", () => {
  it("attaches done flags to the visible sections", () => {
    const state = bookingSectionState("hot-tub", {}, { ...empty, parkId: "p", lodgeId: "l" });
    expect(state.find((s) => s.key === "lodge")?.done).toBe(true);
    expect(state.find((s) => s.key === "hotel")).toBeUndefined();
  });
});
