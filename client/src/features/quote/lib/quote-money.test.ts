import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { getTransactionProfit, getTransactionValue } from "@/features/pipeline/lib/pipeline-helpers";
import { computeQuoteMoney, moneyBarSegments, quoteMarginPercent, quoteProfit, quoteTotal } from "./quote-money";

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
