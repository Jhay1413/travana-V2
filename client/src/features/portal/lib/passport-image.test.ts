import { describe, expect, it } from "vitest";
import { PASSPORT_PHOTO_MAX_EDGE, fitWithin } from "./passport-image";

describe("fitWithin", () => {
  it("leaves a photo that is already small enough alone", () => {
    expect(fitWithin(1600, 1200)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(2000, 2000)).toEqual({ width: 2000, height: 2000 });
  });

  it("shrinks a landscape photo so its long edge is the maximum, keeping its shape", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 2000, height: 1500 });
  });

  it("shrinks a portrait photo the same way", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: PASSPORT_PHOTO_MAX_EDGE });
  });

  it("never makes either edge smaller than one pixel", () => {
    expect(fitWithin(100000, 10)).toEqual({ width: 2000, height: 1 });
  });

  it("answers zero for an unusable size", () => {
    expect(fitWithin(0, 100)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(Number.NaN, 100)).toEqual({ width: 0, height: 0 });
  });

  it("honours a custom limit", () => {
    expect(fitWithin(1000, 500, 400)).toEqual({ width: 400, height: 200 });
  });
});
