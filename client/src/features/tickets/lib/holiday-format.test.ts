import { describe, expect, it } from "vitest";
import { airportLabel, nightsLabel, passengersLabel, positiveAmount } from "./holiday-format";

describe("holiday format helpers", () => {
  it("labels nights", () => {
    expect(nightsLabel(7)).toBe("7 nights");
    expect(nightsLabel(1)).toBe("1 night");
    expect(nightsLabel(0)).toBeNull();
    expect(nightsLabel(null)).toBeNull();
  });
  it("labels passengers", () => {
    expect(passengersLabel({ adults: 2, children: 1, infants: 1 })).toBe("2 adults, 1 child, 1 infant");
    expect(passengersLabel({ adults: 1, children: 3 })).toBe("1 adult, 3 children");
    expect(passengersLabel({})).toBeNull();
  });
  it("reshapes an airport name", () => {
    expect(airportLabel("Newcastle International (NCL)")).toBe("Newcastle International, NCL");
    expect(airportLabel("Gatwick")).toBe("Gatwick");
    expect(airportLabel(null)).toBeNull();
  });
  it("accepts only positive amounts", () => {
    expect(positiveAmount("1250.50")).toBe(1250.5);
    expect(positiveAmount(0)).toBeNull();
    expect(positiveAmount("abc")).toBeNull();
    expect(positiveAmount("")).toBeNull();
    expect(positiveAmount(undefined)).toBeNull();
  });
});
