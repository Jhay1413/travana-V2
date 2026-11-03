import { describe, expect, it } from "vitest";
import { parseLatLng } from "./parse-lat-lng";

describe("parseLatLng", () => {
  it("parses a comma + space separated pair", () => {
    expect(parseLatLng("39.62, 19.92")).toEqual({ lat: 39.62, lng: 19.92 });
  });

  it("parses a space separated pair", () => {
    expect(parseLatLng("39.62 19.92")).toEqual({ lat: 39.62, lng: 19.92 });
  });

  it("parses a parenthesized pair", () => {
    expect(parseLatLng("(39.62, 19.92)")).toEqual({ lat: 39.62, lng: 19.92 });
  });

  it("parses a comma-only separated pair", () => {
    expect(parseLatLng("39.62,19.92")).toEqual({ lat: 39.62, lng: 19.92 });
  });

  it("parses negative coordinates", () => {
    expect(parseLatLng("-33.8688, 151.2093")).toEqual({ lat: -33.8688, lng: 151.2093 });
  });

  it("trims surrounding whitespace", () => {
    expect(parseLatLng("  39.62, 19.92  ")).toEqual({ lat: 39.62, lng: 19.92 });
  });

  it("returns null for an empty string", () => {
    expect(parseLatLng("")).toBeNull();
    expect(parseLatLng("   ")).toBeNull();
  });

  it("returns null when only one number is present", () => {
    expect(parseLatLng("39.62")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(parseLatLng("not, coordinates")).toBeNull();
  });

  it("returns null when latitude is out of range", () => {
    expect(parseLatLng("120, 19.92")).toBeNull();
    expect(parseLatLng("-120, 19.92")).toBeNull();
  });

  it("returns null when longitude is out of range", () => {
    expect(parseLatLng("39.62, 200")).toBeNull();
    expect(parseLatLng("39.62, -200")).toBeNull();
  });
});
