import { describe, it, expect } from "vitest";
import { addImagesValidator, convertQuoteToBookingValidator, updateBookingValidator } from "./booking.validator";

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

describe("updateBookingValidator", () => {
  it("accepts a refs-only body", () => {
    expect(updateBookingValidator.safeParse({ body: { hays_ref: "HAY105391", supplier_ref: "TUI 78451236" } }).success).toBe(true);
  });

  it("passes through the large edit-drawer payload untouched", () => {
    const body = { hays_ref: "HAY1", adult: 2, childAges: [4], flight_meals: true, outboundFlight: { a: 1 } };
    const r = updateBookingValidator.safeParse({ body });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toMatchObject({ adult: 2, childAges: [4], outboundFlight: { a: 1 } });
  });

  it("accepts a body with no references", () => {
    expect(updateBookingValidator.safeParse({ body: { title: "x" } }).success).toBe(true);
  });

  it("rejects null references (the columns are NOT NULL)", () => {
    expect(updateBookingValidator.safeParse({ body: { hays_ref: null } }).success).toBe(false);
    expect(updateBookingValidator.safeParse({ body: { supplier_ref: null } }).success).toBe(false);
  });

  it("rejects empty or whitespace-only references", () => {
    expect(updateBookingValidator.safeParse({ body: { hays_ref: "" } }).success).toBe(false);
    expect(updateBookingValidator.safeParse({ body: { supplier_ref: "   " } }).success).toBe(false);
  });

  it("rejects a non-string reference", () => {
    expect(updateBookingValidator.safeParse({ body: { hays_ref: 12 } }).success).toBe(false);
  });
});

describe("convertQuoteToBookingValidator", () => {
  const params = { quoteId: "q1" };

  it("accepts both references", () => {
    expect(convertQuoteToBookingValidator.safeParse({ params, body: { haysRef: "HAY1", supplierRef: "TUI 2" } }).success).toBe(true);
  });

  it("rejects missing, empty and whitespace-only references", () => {
    expect(convertQuoteToBookingValidator.safeParse({ params, body: { haysRef: "HAY1" } }).success).toBe(false);
    expect(convertQuoteToBookingValidator.safeParse({ params, body: { haysRef: "", supplierRef: "x" } }).success).toBe(false);
    expect(convertQuoteToBookingValidator.safeParse({ params, body: { haysRef: "x", supplierRef: "   " } }).success).toBe(false);
  });
});
