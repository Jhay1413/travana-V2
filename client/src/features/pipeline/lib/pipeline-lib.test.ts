import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { columnFiltersFor, hasActiveFilters, toggleInSet } from "./pipeline-board-filters";
import { visibleColumnItems } from "./column-visibility";
import { getTransactionProfit, getTransactionValue, hasQuoteOrBooking } from "./pipeline-helpers";
import { marginPercent, sumOpenTotals } from "./pipeline-money";
import { isOpenStage, nextStage, stepperIndex } from "./pipeline-stage-style";
import { quietDays, quietTone } from "./quiet";

function tx(partial: Record<string, unknown>): Transaction {
  return { id: "t1", created_at: "2026-10-01T00:00:00Z", user_id: "u", ...partial } as unknown as Transaction;
}

describe("columnFiltersFor", () => {
  const filters = { search: "bob", priority: ["high" as const], quick: "no_task" as const };

  it("passes every filter, including the quick chip, to open columns", () => {
    for (const stage of ["Enquiry", "Quoted", "In Play"] as const) {
      expect(columnFiltersFor(stage, filters)).toEqual({ enabled: true, filters });
    }
  });

  it("disables Booked, Future and Lost while a quick chip is active and strips the chip", () => {
    for (const stage of ["Booked", "Future", "Lost"] as const) {
      expect(columnFiltersFor(stage, filters)).toEqual({ enabled: false, filters: { search: "bob", priority: ["high"] } });
    }
  });

  it("keeps closed columns enabled without a quick chip", () => {
    expect(columnFiltersFor("Booked", { search: "bob" })).toEqual({ enabled: true, filters: { search: "bob" } });
  });
});

describe("filter helpers", () => {
  it("toggleInSet adds and removes without mutating", () => {
    const a = new Set<string>(["x"]);
    const b = toggleInSet(a, "y");
    expect([...b].sort()).toEqual(["x", "y"]);
    expect([...a]).toEqual(["x"]);
    expect([...toggleInSet(b, "x")]).toEqual(["y"]);
  });

  it("hasActiveFilters reports any active filter", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ search: "  " })).toBe(false);
    expect(hasActiveFilters({ quick: "quiet_7" })).toBe(true);
    expect(hasActiveFilters({ tourOperatorId: ["a"] })).toBe(true);
  });
});

describe("sumOpenTotals", () => {
  it("sums only Enquiry, Quoted and In Play", () => {
    const totals = sumOpenTotals({
      Enquiry: { total: 2, totalValue: 0, totalProfit: 0 },
      Quoted: { total: 3, totalValue: 1000, totalProfit: 100 },
      "In Play": { total: 1, totalValue: 500, totalProfit: 50 },
      Booked: { total: 9, totalValue: 99999, totalProfit: 9999 },
      Future: { total: 4, totalValue: 4000, totalProfit: 400 },
      Lost: { total: 5, totalValue: 5000, totalProfit: 500 },
    });
    expect(totals).toEqual({ count: 6, value: 1500, profit: 150 });
  });

  it("copes with missing columns", () => {
    expect(sumOpenTotals({ Quoted: undefined })).toEqual({ count: 0, value: 0, profit: 0 });
  });
});

describe("marginPercent", () => {
  it("rounds profit / cost", () => {
    expect(marginPercent(150, 1000)).toBe(15);
    expect(marginPercent(1, 3)).toBe(33);
    expect(marginPercent(2, 3)).toBe(67);
  });

  it("is null when there is no cost", () => {
    expect(marginPercent(10, 0)).toBeNull();
    expect(marginPercent(10, -5)).toBeNull();
  });
});

describe("visibleColumnItems", () => {
  const items = [1, 2, 3, 4, 5, 6];

  it("previews 4 and counts the rest, including unfetched deals", () => {
    expect(visibleColumnItems(items, 12, false)).toEqual({ visible: [1, 2, 3, 4], hiddenCount: 8 });
  });

  it("shows everything loaded when expanded", () => {
    expect(visibleColumnItems(items, 12, true)).toEqual({ visible: items, hiddenCount: 6 });
  });

  it("hides nothing when the column is short", () => {
    expect(visibleColumnItems([1, 2], 2, false)).toEqual({ visible: [1, 2], hiddenCount: 0 });
  });
});

describe("quiet", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000 - 1000).toISOString();

  it("counts whole days and never goes negative", () => {
    expect(quietDays(daysAgo(0), now)).toBe(0);
    expect(quietDays(daysAgo(6), now)).toBe(6);
    expect(quietDays("2026-10-16T12:00:00Z", now)).toBe(0);
    expect(quietDays(null, now)).toBeNull();
    expect(quietDays("nonsense", now)).toBeNull();
  });

  it("tones at the 7 and 14 day boundaries", () => {
    expect(quietTone(6)).toBe("ok");
    expect(quietTone(7)).toBe("warn");
    expect(quietTone(13)).toBe("warn");
    expect(quietTone(14)).toBe("danger");
  });
});

describe("stage helpers", () => {
  it("nextStage walks Enquiry to Booked and stops", () => {
    expect(nextStage("Enquiry")).toBe("Quoted");
    expect(nextStage("Quoted")).toBe("In Play");
    expect(nextStage("In Play")).toBe("Booked");
    expect(nextStage("Booked")).toBeNull();
    expect(nextStage("Lost")).toBeNull();
    expect(nextStage("Future")).toBeNull();
  });

  it("stepperIndex is -1 off the stepper", () => {
    expect(stepperIndex("Enquiry")).toBe(0);
    expect(stepperIndex("Booked")).toBe(3);
    expect(stepperIndex("Lost")).toBe(-1);
    expect(stepperIndex("Future")).toBe(-1);
  });

  it("isOpenStage covers the three open columns", () => {
    expect(["Enquiry", "Quoted", "In Play"].every((s) => isOpenStage(s as never))).toBe(true);
    expect(["Booked", "Future", "Lost"].some((s) => isOpenStage(s as never))).toBe(false);
  });
});

describe("stage-aware value and profit", () => {
  const quote = (sales: string, disc: string, svc: string, pkg: string, svcComm: number) => ({
    sales_price: sales,
    discounts: disc,
    service_charge: svc,
    package_commission: pkg,
    service_commission: svcComm,
  });

  it("sums quotes for on_quote deals: sales - discounts + service charge", () => {
    const t = tx({ status: "on_quote", quotes: [quote("1000", "100", "20", "80", 5), quote("500", "0", "0", "40", 0)] });
    expect(getTransactionValue(t)).toBe(1420);
    expect(getTransactionProfit(t)).toBe(125);
  });

  it("reads the booking row for on_booking deals, ignoring stale quotes", () => {
    const t = tx({
      status: "on_booking",
      quotes: [quote("9999", "0", "0", "999", 0)],
      booking: quote("2000", "50", "10", "150", 25),
    });
    expect(getTransactionValue(t)).toBe(1960);
    expect(getTransactionProfit(t)).toBe(175);
  });

  it("gives enquiries no value or profit", () => {
    const t = tx({ status: "on_enquiry", enquiry: { budget: "5000" } });
    expect(getTransactionValue(t)).toBe(0);
    expect(getTransactionProfit(t)).toBe(0);
    expect(hasQuoteOrBooking(t)).toBe(false);
  });

  it("hasQuoteOrBooking follows the stage", () => {
    expect(hasQuoteOrBooking(tx({ status: "on_quote", quotes: [quote("1", "0", "0", "0", 0)] }))).toBe(true);
    expect(hasQuoteOrBooking(tx({ status: "on_booking", booking: quote("1", "0", "0", "0", 0) }))).toBe(true);
    expect(hasQuoteOrBooking(tx({ status: "on_booking", quotes: [quote("1", "0", "0", "0", 0)] }))).toBe(false);
  });
});
