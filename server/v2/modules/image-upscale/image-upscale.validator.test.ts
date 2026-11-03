import { describe, it, expect } from "vitest";
import { createUpscaleJobValidator } from "./image-upscale.validator";

const QUOTE_ID = "11111111-1111-4111-8111-111111111111";

describe("createUpscaleJobValidator", () => {
  it("rejects imageUrl without quoteId", () => {
    const result = createUpscaleJobValidator.safeParse({ body: { imageUrl: "/api/v2/files/img?key=a" } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("quoteId is required when using imageUrl");
    }
  });

  it("accepts imageUrl with quoteId", () => {
    const result = createUpscaleJobValidator.safeParse({ body: { quoteId: QUOTE_ID, imageUrl: "/x" } });
    expect(result.success).toBe(true);
  });

  it("accepts an empty body (standalone file upload)", () => {
    expect(createUpscaleJobValidator.safeParse({ body: {} }).success).toBe(true);
  });

  it("still rejects a malformed quoteId", () => {
    expect(createUpscaleJobValidator.safeParse({ body: { quoteId: "nope" } }).success).toBe(false);
  });
});
