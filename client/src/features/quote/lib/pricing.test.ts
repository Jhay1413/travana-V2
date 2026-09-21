import { describe, it, expect } from "vitest";
import { commissionForOperator, operatorCommissionPct, pricePerPersonFor, recomputePricing, type PricingSnapshot } from "./pricing";

const base: PricingSnapshot = {
  price: 1000,
  discount: 0,
  serviceCharge: 0,
  commission: 100,
  adults: 2,
  children: 0,
  operatorCommissionPct: 10,
};

describe("recomputePricing", () => {
  it("recomputes commission from the operator % when the price changes", () => {
    expect(recomputePricing("price", 2000, base)).toEqual({ commission: 200, pricePerPerson: 1000 });
  });

  it("takes the discount off the commission and adds the service charge", () => {
    expect(recomputePricing("discount", 25, base).commission).toBe(75);
    expect(recomputePricing("serviceCharge", 15, base).commission).toBe(115);
  });

  it("splits the net price across adults and children", () => {
    const snap = { ...base, adults: 2, children: 2, discount: 100 };
    expect(recomputePricing("serviceCharge", 20, snap).pricePerPerson).toBe(230);
  });

  it("returns 0 per person when there are no passengers", () => {
    expect(recomputePricing("price", 500, { ...base, adults: 0, children: 0 }).pricePerPerson).toBe(0);
  });

  it("leaves commission alone on a price change without an operator %", () => {
    expect(recomputePricing("price", 2000, { ...base, operatorCommissionPct: null }).commission).toBeNull();
  });

  it("adjusts commission by the delta when there is no operator %", () => {
    const snap = { ...base, operatorCommissionPct: null, discount: 10, serviceCharge: 5 };
    expect(recomputePricing("discount", 30, snap).commission).toBe(80);
    expect(recomputePricing("serviceCharge", 25, snap).commission).toBe(120);
  });

  it("leaves commission alone when the price drops to zero with an operator %", () => {
    expect(recomputePricing("price", 0, base).commission).toBeNull();
  });

  it("rounds to pennies", () => {
    expect(recomputePricing("price", 333.33, { ...base, adults: 3 })).toEqual({
      commission: 33.33,
      pricePerPerson: 111.11,
    });
  });
});

describe("pricePerPersonFor", () => {
  it("splits (price − discount + service charge) across adults and children", () => {
    expect(pricePerPersonFor(1000, 0, 0, 2, 0)).toBe(500);
    expect(pricePerPersonFor(1200, 100, 20, 2, 2)).toBe(280);
  });

  it("returns 0 rather than dividing by zero when there are no travellers", () => {
    expect(pricePerPersonFor(1000, 0, 0, 0, 0)).toBe(0);
  });

  it("treats missing/non-numeric inputs as zero", () => {
    expect(pricePerPersonFor(undefined, null, "", 2, 0)).toBe(0);
  });

  it("rounds to pennies", () => {
    expect(pricePerPersonFor(333.33, 0, 0, 3, 0)).toBe(111.11);
  });
});

describe("operatorCommissionPct", () => {
  it("parses numeric strings and numbers", () => {
    expect(operatorCommissionPct({ commission_percentage: "12.5" })).toBe(12.5);
    expect(operatorCommissionPct({ commission_percentage: 8 })).toBe(8);
  });

  it("returns null for a missing or unparseable percentage", () => {
    expect(operatorCommissionPct(undefined)).toBeNull();
    expect(operatorCommissionPct({ commission_percentage: null })).toBeNull();
    expect(operatorCommissionPct({ commission_percentage: "n/a" })).toBeNull();
  });
});

describe("commissionForOperator", () => {
  it("applies the operator % then the discount and service charge", () => {
    expect(commissionForOperator(10, "1000", "50", "20")).toBe(70);
  });

  it("treats blank inputs as zero", () => {
    expect(commissionForOperator(10, "", undefined, null)).toBe(0);
  });
});
