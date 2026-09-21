import { describe, expect, it } from "vitest";
import { parseHslTriplet } from "./theme-color";

describe("parseHslTriplet", () => {
  it("parses a standard triplet", () => {
    expect(parseHslTriplet("217 91% 60%")).toEqual({ h: 217, s: 91, l: 60 });
  });

  it("handles decimals", () => {
    expect(parseHslTriplet("217.5 91.2% 60.75%")).toEqual({ h: 217.5, s: 91.2, l: 60.75 });
  });

  it("handles extra / irregular whitespace", () => {
    expect(parseHslTriplet("  217   91%    60%  ")).toEqual({ h: 217, s: 91, l: 60 });
  });

  it("returns null for malformed input", () => {
    expect(parseHslTriplet("not-a-color")).toBeNull();
    expect(parseHslTriplet("217, 91%, 60%")).toBeNull();
    expect(parseHslTriplet("217 91 60")).toBeNull();
    expect(parseHslTriplet("")).toBeNull();
    expect(parseHslTriplet(undefined)).toBeNull();
    expect(parseHslTriplet(null)).toBeNull();
  });

  it("handles negative hue gracefully", () => {
    expect(parseHslTriplet("-10 50% 50%")).toEqual({ h: -10, s: 50, l: 50 });
  });
});
