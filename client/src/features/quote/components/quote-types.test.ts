import { describe, expect, it } from "vitest";
import type { EnrichedBooking, EnrichedQuote } from "@/features/quote/types";
import { transformQuoteData } from "./quote-types";

function quote(over: Record<string, unknown> = {}): EnrichedQuote {
  return {
    id: "q1",
    transaction_id: "t1",
    sales_price: "2000.00",
    discounts: "100.00",
    service_charge: "50.00",
    package_commission: "200.00",
    service_commission: 40,
    adult: 2,
    child: 0,
    ...over,
  } as unknown as EnrichedQuote;
}

describe("transformQuoteData — profit and margin", () => {
  it("profit is package commission plus the line-item service commission", () => {
    expect(transformQuoteData(quote()).profit).toBe(240);
  });

  it("margin is profit as a percentage of the total price (sales − discounts + service charge)", () => {
    // total = 2000 − 100 + 50 = 1950
    expect(transformQuoteData(quote()).marginPercent).toBeCloseTo((240 / 1950) * 100, 6);
  });

  it("prefers the backend total_price for the margin denominator", () => {
    expect(transformQuoteData(quote({ total_price: "1200.00" })).marginPercent).toBeCloseTo((240 / 1200) * 100, 6);
  });

  it("has a null margin when the total price is not positive", () => {
    const d = transformQuoteData(quote({ sales_price: "0", discounts: "0", service_charge: "0" }));
    expect(d.marginPercent).toBeNull();
    expect(d.profit).toBe(240);
  });

  it("falls back to package commission alone when the API sends no service_commission", () => {
    expect(transformQuoteData(quote({ service_commission: undefined })).profit).toBe(200);
  });

  it("works for bookings too", () => {
    const booking = { ...quote(), hays_ref: "HAY1" } as unknown as EnrichedBooking;
    expect(transformQuoteData(booking).profit).toBe(240);
  });
});
