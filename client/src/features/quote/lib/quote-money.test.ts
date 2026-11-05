import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { getTransactionProfit, getTransactionValue } from "@/features/pipeline/lib/pipeline-helpers";
import { computeQuoteMoney, extrasCommission, extrasCustomerTotal, formFinalTotal, formTotalProfit, moneyBarSegments, quoteMarginPercent, quoteProfit, quoteTotal } from "./quote-money";

const ROW = {
  sales_price: "2000.00",
  discounts: "100.00",
  service_charge: "50.00",
  package_commission: "200.00",
  service_commission: 40,
};

describe("quoteTotal / quoteProfit", () => {
  it("total = sales − discounts + service charge", () => {
    expect(quoteTotal(ROW)).toBe(1950);
  });

  it("profit = package commission + service commission", () => {
    expect(quoteProfit(ROW)).toBe(240);
  });

  it("treats missing, null and junk values as 0", () => {
    expect(quoteTotal({})).toBe(0);
    expect(quoteProfit({ package_commission: null, service_commission: "abc" })).toBe(0);
    expect(quoteProfit({ package_commission: "10", service_commission: undefined })).toBe(10);
  });

  it("accepts a numeric service_commission as returned by the API", () => {
    expect(quoteProfit({ package_commission: "100.50", service_commission: 0.25 })).toBe(100.75);
  });
});

describe("quoteMarginPercent", () => {
  it("is profit ÷ total × 100", () => {
    expect(quoteMarginPercent(240, 1950)).toBeCloseTo(12.3077, 3);
  });

  it("is null when the total is zero or negative", () => {
    expect(quoteMarginPercent(100, 0)).toBeNull();
    expect(quoteMarginPercent(100, -5)).toBeNull();
  });

  it("allows a zero or negative profit on a positive total", () => {
    expect(quoteMarginPercent(0, 100)).toBe(0);
    expect(quoteMarginPercent(-10, 100)).toBe(-10);
  });
});

describe("computeQuoteMoney", () => {
  it("bundles the figures", () => {
    const m = computeQuoteMoney(ROW);
    expect(m).toMatchObject({ total: 1950, packagePrice: 2000, discount: 100, serviceCharge: 50, profit: 240 });
    expect(m.marginPercent).toBeCloseTo(12.3077, 3);
  });

  it("has a null margin for an empty quote", () => {
    expect(computeQuoteMoney({}).marginPercent).toBeNull();
  });
});

describe("pipeline parity", () => {
  const quoteTx = {
    id: "t1",
    status: "on_quote",
    quotes: [ROW],
  } as unknown as Transaction;
  const bookingTx = {
    id: "t2",
    status: "on_booking",
    booking: ROW,
  } as unknown as Transaction;

  it("matches getTransactionValue / getTransactionProfit for a quoted deal", () => {
    expect(quoteTotal(ROW)).toBe(getTransactionValue(quoteTx));
    expect(quoteProfit(ROW)).toBe(getTransactionProfit(quoteTx));
  });

  it("matches the pipeline for a booked deal (upsells are ignored by both)", () => {
    const withUpsells = { ...bookingTx, booking: { ...ROW, upsells: [{ sales_price: "500", commission: "50" }] } } as unknown as Transaction;
    expect(quoteTotal(ROW)).toBe(getTransactionValue(withUpsells));
    expect(quoteProfit(ROW)).toBe(getTransactionProfit(withUpsells));
  });

  it("matches when there is no service commission", () => {
    const row = { sales_price: "800", discounts: null, service_charge: null, package_commission: "64" };
    const tx = { id: "t3", status: "on_quote", quotes: [row] } as unknown as Transaction;
    expect(quoteTotal(row)).toBe(getTransactionValue(tx));
    expect(quoteProfit(row)).toBe(getTransactionProfit(tx));
  });
});

describe("moneyBarSegments", () => {
  it("adds up to the total price when profit covers the discount", () => {
    const segs = moneyBarSegments(computeQuoteMoney(ROW));
    expect(segs.map((s) => s.key)).toEqual(["package", "commission", "service"]);
    expect(segs.map((s) => s.amount)).toEqual([1760, 140, 50]);
    expect(segs.reduce((s, x) => s + x.widthPercent, 0)).toBeCloseTo(100, 6);
  });

  it("drops the commission segment when the discount eats the profit", () => {
    const segs = moneyBarSegments(computeQuoteMoney({ sales_price: 1000, discounts: 300, package_commission: 100 }));
    expect(segs.map((s) => s.key)).toEqual(["package"]);
  });

  it("draws nothing without a positive total", () => {
    expect(moneyBarSegments(computeQuoteMoney({}))).toEqual([]);
  });
});

describe("extrasCommission / formTotalProfit", () => {
  it("sums commission across every extras group, tolerating strings and blanks", () => {
    expect(
      extrasCommission({
        transfers: [{ commission: 10 }, { commission: "5.5" }],
        carHires: [{ commission: 20 }],
        attractionTickets: [{ commission: "" }],
        loungePasses: [{ commission: 1 }],
        airportParkings: [{ commission: 2 }],
        extraAccommodations: [{ commission: 3 }],
      }),
    ).toBeCloseTo(41.5);
  });

  it("is 0 for missing or empty groups", () => {
    expect(extrasCommission({})).toBe(0);
    expect(extrasCommission({ transfers: null, carHires: [] })).toBe(0);
  });

  it("zeroed included-in-package rows add nothing", () => {
    expect(extrasCommission({ transfers: [{ commission: 0 }] })).toBe(0);
  });

  it("total profit = package commission + extras commission, same as quoteProfit", () => {
    const extras = { transfers: [{ commission: 25 }], carHires: [{ commission: 15 }] };
    expect(formTotalProfit(200, extras)).toBe(240);
    expect(formTotalProfit("200", extras)).toBe(
      quoteProfit({ package_commission: "200", service_commission: 40 }),
    );
  });

  it("with no extras equals the package commission", () => {
    expect(formTotalProfit(150, {})).toBe(150);
  });
});

describe("extras and the customer total", () => {
  it("formFinalTotal = price - discount + service charge + not-included extras", () => {
    const extras = { transfers: [{ cost: 100, isIncludedInPackage: false }, { cost: 50, isIncludedInPackage: true }] };
    expect(formFinalTotal("1000", 50, "20", extras)).toBe(1070);
    expect(formFinalTotal(1000, 50, 20, {})).toBe(970);
  });

  it("extrasCustomerTotal counts the cost of not-included extras only", () => {
    expect(extrasCustomerTotal({ transfers: [{ cost: 80, isIncludedInPackage: false }] })).toBe(80);
    expect(extrasCustomerTotal({ transfers: [{ cost: 80, isIncludedInPackage: true }] })).toBe(0);
  });

  it("mixed included and not-included rows across all six types", () => {
    const total = extrasCustomerTotal({
      transfers: [{ cost: 50, isIncludedInPackage: false }, { cost: 999, isIncludedInPackage: true }],
      carHires: [{ cost: "120.50", isIncludedInPackage: false }],
      attractionTickets: [{ cost: 30, isIncludedInPackage: false }],
      loungePasses: [{ cost: 25, isIncludedInPackage: true }],
      airportParkings: [{ cost: 60, isIncludedInPackage: false }],
      extraAccommodations: [{ cost: 200, isIncludedInPackage: false }],
    });
    expect(total).toBe(460.5);
  });

  it("null / undefined included flag counts as included (old deals keep their totals), matching the server", () => {
    expect(extrasCustomerTotal({ loungePasses: [{ cost: 10 }, { cost: 5, isIncludedInPackage: null }] })).toBe(0);
    expect(extrasCustomerTotal({ loungePasses: [{ cost: 10 }, { cost: 5, isIncludedInPackage: false }] })).toBe(5);
  });

  it("handles missing groups and junk amounts", () => {
    expect(extrasCustomerTotal({})).toBe(0);
    expect(extrasCustomerTotal({ transfers: [{ cost: "abc", isIncludedInPackage: false }] })).toBe(0);
  });

  it("quoteTotal / computeQuoteMoney add extras_total on top of sales - discounts + service charge", () => {
    const input = { sales_price: "2000", discounts: "100", service_charge: "50", extras_total: "150" };
    expect(quoteTotal(input)).toBe(2100);
    expect(computeQuoteMoney(input).extras).toBe(150);
    expect(quoteTotal({ ...input, extras_total: undefined })).toBe(1950);
  });

  it("the money bar segments still add up to the total with extras", () => {
    const money = computeQuoteMoney({ sales_price: 1000, package_commission: 100, extras_total: 200 });
    const sum = moneyBarSegments(money).reduce((s, x) => s + x.amount, 0);
    expect(sum).toBe(money.total);
    expect(moneyBarSegments(money).some((s) => s.key === "extras")).toBe(true);
  });

  it("form total (price - discount + service + extras) equals the card sum for the same data", () => {
    const extras = { transfers: [{ cost: 75, isIncludedInPackage: false }, { cost: 40, isIncludedInPackage: true }] };
    const formTotal = 1000 - 50 + 20 + extrasCustomerTotal(extras);
    const cardTotal = quoteTotal({ sales_price: 1000, discounts: 50, service_charge: 20, extras_total: 75 });
    expect(formTotal).toBe(cardTotal);
  });
});
