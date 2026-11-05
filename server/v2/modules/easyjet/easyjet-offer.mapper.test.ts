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

// A booking with several rooms holds one accom unit per room. Reading only the
// first unit under-counted the party and dropped every other room's name.
describe("mapOfferToScrapedQuote — multiple rooms", () => {
  const units = (list: unknown[]) => offersPayload({ accom: { unit: list } });

  it("sums adults, children and infants across all units", () => {
    const quote = mapOfferToScrapedQuote(
      units([
        { code: "DB01", occupation: { adults: 2, children: 1, infants: 0 } },
        { code: "TW01", occupation: { adults: 2, children: 0, infants: 1 } },
      ]),
      "https://example.com/deal",
    );
    expect(quote.adults).toBe(4);
    expect(quote.children).toBe(1);
    expect(quote.infants).toBe(1);
  });

  it("joins distinct room names with ' + ' and drops repeats", () => {
    const quote = mapOfferToScrapedQuote(
      units([
        { code: "DB01", roomType: { title: "Double Room" } },
        { code: "TW01", roomType: { title: "Twin Room" } },
        { code: "DB02", roomType: { title: "double room" } },
      ]),
      "https://example.com/deal",
    );
    expect(quote.room_type).toBe("Double Room + Twin Room");
  });

  it("keeps the single-room behaviour: code fallback and the default of 2 adults", () => {
    const quote = mapOfferToScrapedQuote(units([{ code: "DB01" }]), "https://example.com/deal");
    expect(quote.room_type).toBe("DB01");
    expect(quote.adults).toBe(2);
    expect(quote.children).toBe(0);
  });
});
