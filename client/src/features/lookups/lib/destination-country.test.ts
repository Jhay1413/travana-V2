import { describe, expect, it } from "vitest";
import { countryToSetForDestination } from "./destination-country";

const dubai = { id: "d1", country_id: "uae" };
const orphan = { id: "d2", country_id: null };

describe("countryToSetForDestination", () => {
  it("returns the destination's country when the form has none", () => {
    expect(countryToSetForDestination([dubai], "d1", "")).toBe("uae");
    expect(countryToSetForDestination([dubai], "d1", undefined)).toBe("uae");
  });

  it("returns the destination's country when the form holds a different one", () => {
    expect(countryToSetForDestination([dubai], "d1", "spain")).toBe("uae");
  });

  it("leaves an already-correct country alone", () => {
    expect(countryToSetForDestination([dubai], "d1", "uae")).toBeNull();
  });

  it("does nothing for an unknown destination or one without a country", () => {
    expect(countryToSetForDestination([dubai], "nope", "spain")).toBeNull();
    expect(countryToSetForDestination([orphan], "d2", "spain")).toBeNull();
  });
});
