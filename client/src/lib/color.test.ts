import { describe, it, expect } from "vitest";
import { contrastRatio, formatHsl, hexToHslParts, hexToHslTriple, hexToRgb, pickForegroundHsl, relativeLuminance } from "./color";

describe("hexToRgb", () => {
  it("parses 6 and 3 digit hex, with or without #", () => {
    expect(hexToRgb("#ff8000")).toEqual({ r: 255, g: 128, b: 0 });
    expect(hexToRgb("f80")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("rejects anything else", () => {
    for (const bad of ["", "#12", "#12345", "#1234567", "#gggggg", "red"]) expect(hexToRgb(bad)).toBeNull();
  });
});

describe("hexToHslParts", () => {
  it("converts primaries", () => {
    expect(hexToHslParts("#ff0000")).toEqual({ h: 0, s: 100, l: 50 });
    expect(hexToHslParts("#00ff00")).toEqual({ h: 120, s: 100, l: 50 });
    expect(hexToHslParts("#0000ff")).toEqual({ h: 240, s: 100, l: 50 });
  });
  it("handles greys and extremes", () => {
    expect(hexToHslParts("#000000")).toEqual({ h: 0, s: 0, l: 0 });
    expect(hexToHslParts("#ffffff")).toEqual({ h: 0, s: 0, l: 100 });
    expect(hexToHslParts("#808080")?.s).toBe(0);
  });
  it("converts the portal navy to its token", () => {
    expect(hexToHslTriple("#002c60")).toBe("212.5 100.0% 18.8%");
  });
  it("returns null for junk", () => {
    expect(hexToHslParts("nope")).toBeNull();
    expect(hexToHslTriple("nope")).toBeNull();
  });
});

describe("formatHsl / pickForegroundHsl", () => {
  it("formats with one decimal", () => {
    expect(formatHsl(212, 100, 18.75)).toBe("212.0 100.0% 18.8%");
  });
  it("uses dark text on light colours and white on dark (staff rule)", () => {
    expect(pickForegroundHsl(80)).toBe("240 10% 10%");
    expect(pickForegroundHsl(30)).toBe("0 0% 100%");
  });
});

describe("contrast", () => {
  it("luminance of black and white", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });
  it("black on white is 21:1 and is symmetric", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
  it("returns null for an invalid colour", () => {
    expect(contrastRatio("x", "#fff")).toBeNull();
  });
});
