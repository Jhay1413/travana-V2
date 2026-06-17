import { describe, it, expect } from "vitest";
import { addImagesValidator } from "./booking.validator";

describe("addImagesValidator", () => {
  it("accepts one or more valid image URLs", () => {
    expect(addImagesValidator.safeParse({ body: { images: ["https://cdn.example.com/a.jpg"] } }).success).toBe(true);
  });

  it("rejects an empty image array", () => {
    expect(addImagesValidator.safeParse({ body: { images: [] } }).success).toBe(false);
  });

  it("rejects a non-URL string", () => {
    expect(addImagesValidator.safeParse({ body: { images: ["not-a-url"] } }).success).toBe(false);
  });
});
