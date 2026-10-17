import { describe, expect, it } from "vitest";
import type { Airport } from "@/features/airport/types";
import { findUkCountry, withPinnedAirportsFirst } from "./uk-airports";

const ap = (id: string, code: string): Airport => ({ id, airport_name: id, airport_code: code, country_id: "uk", createdAt: "" });

describe("findUkCountry", () => {
  it("matches by name or code, case-insensitively", () => {
    expect(findUkCountry([{ id: "1", country_name: "Spain", country_code: "ES" }])).toBeUndefined();
    expect(findUkCountry([{ id: "2", country_name: "United Kingdom", country_code: null }])?.id).toBe("2");
    expect(findUkCountry([{ id: "3", country_name: "Britain", country_code: "gb" }])?.id).toBe("3");
    expect(findUkCountry(undefined)).toBeUndefined();
  });
});

describe("withPinnedAirportsFirst", () => {
  it("moves NCL to the front and keeps the rest in order", () => {
    const out = withPinnedAirportsFirst([ap("a", "MAN"), ap("b", "ncl"), ap("c", "LHR")]);
    expect(out.map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
  it("leaves the list alone when NCL is absent", () => {
    expect(withPinnedAirportsFirst([ap("a", "MAN")]).map((x) => x.id)).toEqual(["a"]);
  });
});
