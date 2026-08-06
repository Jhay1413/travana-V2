import { describe, expect, it } from "vitest";
import { mapOfferToScrapedQuote } from "./easyjet-offer.mapper";
import { offersResponseSchema } from "./easyjet-offer.schema";

// sales_price must be the TAX-EXCLUSIVE package price when the offers API
// breaks it out (tourist tax is paid locally by the client), falling back to
// the inclusive `price` for payloads that don't carry the split.

function offersPayload(overrides: Record<string, unknown>) {
  return offersResponseSchema.parse({
    hotel: { name: "AMOH, a Luxury Collection Resort" },
    offers: [
      {
        date: "2026-08-14T00:00:00+00:00",
        stay: 7,
        price: 4583,
        touristTax: 10,
        accom: { unit: [{ code: "DB01" }] },
        ...overrides,
      },
    ],
  });
}

describe("mapOfferToScrapedQuote — sales_price", () => {
  it("uses priceExcludingTouristTax when the API provides it", () => {
    const data = offersPayload({ priceExcludingTouristTax: 4573 });
    const quote = mapOfferToScrapedQuote(data, "https://example.com/deal");
    expect(quote.sales_price).toBe(4573);
    expect(quote.tourist_tax_total).toBe(10);
  });

  it("falls back to the inclusive price when the split is absent", () => {
    const quote = mapOfferToScrapedQuote(offersPayload({}), "https://example.com/deal");
    expect(quote.sales_price).toBe(4583);
  });
});
