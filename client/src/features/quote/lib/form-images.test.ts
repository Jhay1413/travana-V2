import { describe, expect, it } from "vitest";
import { existingImageItem, imagesChanged, urlImageItem, withoutFailedUrlItem } from "./form-images";

describe("withoutFailedUrlItem", () => {
  it("drops an imported URL image that failed to load", () => {
    const good = urlImageItem("https://cdn.test/a.jpg");
    const broken = urlImageItem("https://cdn.test/broken.jpg");
    const out = withoutFailedUrlItem([good, broken], broken.key);
    expect(out).toEqual([good]);
  });

  it("keeps a saved image that fails to load so it can be deleted on purpose", () => {
    const saved = existingImageItem("img-1", "https://cdn.test/saved.jpg");
    expect(withoutFailedUrlItem([saved], saved.key)).toEqual([saved]);
  });

  it("leaves the list untouched for an unknown key", () => {
    const a = urlImageItem("https://cdn.test/a.jpg");
    expect(withoutFailedUrlItem([a], "nope")).toEqual([a]);
  });
});

describe("imagesChanged", () => {
  const a = existingImageItem("a", "u1");
  const b = existingImageItem("b", "u2");
  it("is false for the untouched list", () => expect(imagesChanged([a.key, b.key], [a, b])).toBe(false));
  it("detects removal, addition and reorder", () => {
    expect(imagesChanged([a.key, b.key], [a])).toBe(true);
    expect(imagesChanged([a.key], [a, b])).toBe(true);
    expect(imagesChanged([a.key, b.key], [b, a])).toBe(true);
  });
  it("is false for an empty list that stayed empty", () => expect(imagesChanged([], [])).toBe(false));
});
