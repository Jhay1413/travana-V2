import { describe, expect, it } from "vitest";
import { isPreviewSearch } from "./preview-search";

describe("isPreviewSearch", () => {
  it("is true only for preview=1", () => {
    expect(isPreviewSearch("?preview=1")).toBe(true);
    expect(isPreviewSearch("?a=b&preview=1")).toBe(true);
    expect(isPreviewSearch("?preview=0")).toBe(false);
    expect(isPreviewSearch("")).toBe(false);
  });
});
