import { describe, it, expect } from "vitest";
import { DEFAULT_DEAL_FILTERS, dealsEmptyKind, hasExplicitFilter, initialDealsTab, isFilteringByInterests, selectCountry, selectTag } from "./deals";

describe("initialDealsTab", () => {
  it("opens For you only for ?tab=for-you", () => {
    expect(initialDealsTab("?tab=for-you")).toBe("for-you");
    expect(initialDealsTab("")).toBe("latest");
    expect(initialDealsTab("?tab=other")).toBe("latest");
  });
});

describe("selectTag", () => {
  it("turns the interest filter off while a tag is chosen and back on when it is cleared", () => {
    const chosen = selectTag(DEFAULT_DEAL_FILTERS, "Beaches");
    expect(chosen).toEqual({ tag: "Beaches", country: undefined, matchInterests: false });
    const cleared = selectTag(chosen, "Beaches");
    expect(cleared).toEqual({ tag: undefined, country: undefined, matchInterests: true });
  });

  it("switching straight to another tag keeps the interest filter off", () => {
    const next = selectTag(selectTag(DEFAULT_DEAL_FILTERS, "Beaches"), "Golf");
    expect(next.tag).toBe("Golf");
    expect(next.matchInterests).toBe(false);
  });

  it("leaves the country alone", () => {
    expect(selectTag({ ...DEFAULT_DEAL_FILTERS, country: "Spain" }, "Golf").country).toBe("Spain");
  });
});

describe("selectCountry", () => {
  it("sets and clears the country without touching the interest filter", () => {
    const set = selectCountry(DEFAULT_DEAL_FILTERS, "Spain");
    expect(set).toEqual({ tag: undefined, country: "Spain", matchInterests: true });
    expect(selectCountry(set, "").country).toBeUndefined();
  });
});

describe("hasExplicitFilter / isFilteringByInterests", () => {
  it("counts a tag or a country, not the interest toggle", () => {
    expect(hasExplicitFilter(DEFAULT_DEAL_FILTERS)).toBe(false);
    expect(hasExplicitFilter({ ...DEFAULT_DEAL_FILTERS, country: "Spain" })).toBe(true);
    expect(hasExplicitFilter({ ...DEFAULT_DEAL_FILTERS, tag: "Golf" })).toBe(true);
  });

  it("filters by interests only on Latest, with interests saved, and the toggle on", () => {
    expect(isFilteringByInterests("latest", true, DEFAULT_DEAL_FILTERS)).toBe(true);
    expect(isFilteringByInterests("latest", false, DEFAULT_DEAL_FILTERS)).toBe(false);
    expect(isFilteringByInterests("for-you", true, DEFAULT_DEAL_FILTERS)).toBe(false);
    expect(isFilteringByInterests("latest", true, { ...DEFAULT_DEAL_FILTERS, matchInterests: false })).toBe(false);
  });
});

describe("dealsEmptyKind", () => {
  it("picks the most specific message", () => {
    expect(dealsEmptyKind("for-you", false, DEFAULT_DEAL_FILTERS)).toBe("for-you");
    expect(dealsEmptyKind("latest", true, { ...DEFAULT_DEAL_FILTERS, country: "Spain" })).toBe("filters");
    expect(dealsEmptyKind("latest", true, DEFAULT_DEAL_FILTERS)).toBe("interests");
    expect(dealsEmptyKind("latest", false, DEFAULT_DEAL_FILTERS)).toBe("none");
  });
});
