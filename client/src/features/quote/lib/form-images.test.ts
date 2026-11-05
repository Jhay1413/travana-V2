import { describe, expect, it } from "vitest";
import { existingImageItem, urlImageItem, withoutFailedUrlItem } from "./form-images";

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
