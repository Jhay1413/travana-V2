import { describe, expect, it } from "vitest";
import { findUkCountry } from "./uk-airports";


describe("findUkCountry", () => {
  it("matches by name or code, case-insensitively", () => {
    expect(findUkCountry([{ id: "1", country_name: "Spain", country_code: "ES" }])).toBeUndefined();
    expect(findUkCountry([{ id: "2", country_name: "United Kingdom", country_code: null }])?.id).toBe("2");
    expect(findUkCountry([{ id: "3", country_name: "Britain", country_code: "gb" }])?.id).toBe("3");
    expect(findUkCountry(undefined)).toBeUndefined();
  });
});

