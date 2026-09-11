import { describe, expect, it } from "vitest";
import { isImageType } from "./attachment-kind";

describe("isImageType", () => {
  it("recognises common image MIME types", () => {
    expect(isImageType("image/png")).toBe(true);
    expect(isImageType("image/jpeg")).toBe(true);
    expect(isImageType("image/gif")).toBe(true);
    expect(isImageType("image/webp")).toBe(true);
  });

  it("rejects non-image MIME types", () => {
    expect(isImageType("application/pdf")).toBe(false);
    expect(isImageType("text/plain")).toBe(false);
    expect(isImageType("application/octet-stream")).toBe(false);
  });
});
