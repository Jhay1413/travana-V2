import { describe, it, expect } from "vitest";
import { noParkMatchesSearch } from "./park-search";

const parks = [{ name: "Sunhaven" }, { name: null }, { name: "Lakeside Park" }];

describe("noParkMatchesSearch", () => {
  it("is false for an empty or blank search", () => {
    expect(noParkMatchesSearch(parks, "")).toBe(false);
    expect(noParkMatchesSearch(parks, "   ")).toBe(false);
  });

  it("is false when a park name contains the text, ignoring case", () => {
    expect(noParkMatchesSearch(parks, "lakeside")).toBe(false);
    expect(noParkMatchesSearch(parks, " SUN ")).toBe(false);
  });

  it("is true when nothing matches", () => {
    expect(noParkMatchesSearch(parks, "Moorland")).toBe(true);
    expect(noParkMatchesSearch([], "Moorland")).toBe(true);
  });
});
