import { describe, expect, it } from "vitest";
import { mapToIdsValidator } from "./json-mapper.validator";

describe("mapToIdsValidator", () => {
  it("accepts a scraped payload and keeps unknown keys", () => {
    const r = mapToIdsValidator.parse({ body: { tourOperator: "TUI", outboundDepartAirport: "MAN", transfers: [{ tourOperator: "TUI" }] } });
    expect(r.body).toMatchObject({ outboundDepartAirport: "MAN" });
  });

  it("caps the operator name at 120 characters, also on line items", () => {
    expect(mapToIdsValidator.safeParse({ body: { tourOperator: "a".repeat(121) } }).success).toBe(false);
    expect(mapToIdsValidator.safeParse({ body: { transfers: [{ tourOperator: "a".repeat(121) }] } }).success).toBe(false);
  });

  it("rejects non-string text fields and oversized line-item arrays", () => {
    expect(mapToIdsValidator.safeParse({ body: { country: 5 } }).success).toBe(false);
    expect(mapToIdsValidator.safeParse({ body: { transfers: Array.from({ length: 51 }, () => ({})) } }).success).toBe(false);
  });
});
