import { describe, expect, it } from "vitest";
import { mosaicTiles } from "./hero-mosaic";

const img = (id: string, isPrimary = false, url = `u-${id}`) => ({ id, url, isPrimary });

describe("mosaicTiles", () => {
  it("puts the primary image first", () => {
    const { tiles } = mosaicTiles([img("a"), img("b", true), img("c")]);
    expect(tiles.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });
  it("uses the first image when none is primary", () => {
    expect(mosaicTiles([img("a"), img("b")]).tiles.map((t) => t.id)).toEqual(["a", "b"]);
  });
  it("fills the rest with placeholders", () => {
    const result = mosaicTiles([img("a"), img("b")]);
    expect(result.placeholders).toBe(3);
    expect(result.extra).toBe(0);
  });
  it("counts the photos beyond the mosaic", () => {
    const images = Array.from({ length: 8 }, (_, i) => img(String(i)));
    const result = mosaicTiles(images);
    expect(result.tiles).toHaveLength(5);
    expect(result.extra).toBe(3);
    expect(result.placeholders).toBe(0);
  });
  it("skips images without a url and handles none", () => {
    expect(mosaicTiles([img("a", false, "")]).tiles).toEqual([]);
    expect(mosaicTiles([]).placeholders).toBe(5);
  });
  it("honours a custom max", () => {
    expect(mosaicTiles([img("a"), img("b"), img("c")], 2)).toMatchObject({ extra: 1, placeholders: 0 });
  });
});

describe("orderImages", () => {
  it("returns every image with the primary first", async () => {
    const { orderImages } = await import("./hero-mosaic");
    const all = orderImages([img("a"), img("b"), img("c", true), img("d", false, "")]);
    expect(all.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });
});
