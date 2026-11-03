import { describe, it, expect } from "vitest";
import {
  canFinalise,
  currentMonth,
  displayFigures,
  driftMessage,
  finaliseEnabled,
  formatMoney,
  groupLines,
  monthKey,
  monthPeriod,
  parseMonthKey,
  shiftMonth,
} from "./statement";
import type { StatementLine, StatementResult } from "../statement-types";

describe("monthPeriod", () => {
  it("returns first of month to first of next month (exclusive)", () => {
    expect(monthPeriod({ year: 2026, month: 3 })).toEqual({ from: "2026-03-01", to: "2026-04-01" });
  });
  it("rolls December into January of the next year", () => {
    expect(monthPeriod({ year: 2026, month: 12 })).toEqual({ from: "2026-12-01", to: "2027-01-01" });
  });
});

describe("month helpers", () => {
  it("round-trips month keys and rejects bad ones", () => {
    expect(parseMonthKey(monthKey({ year: 2026, month: 7 }))).toEqual({ year: 2026, month: 7 });
    expect(parseMonthKey("2026-13")).toBeNull();
    expect(parseMonthKey("nope")).toBeNull();
  });
  it("shifts across year boundaries", () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 });
  });
  it("uses the UTC month for the current month", () => {
    expect(currentMonth(new Date("2026-10-31T23:30:00Z"))).toEqual({ year: 2026, month: 10 });
  });
});

describe("canFinalise / finaliseEnabled", () => {
  const now = new Date("2026-10-14T12:00:00Z");
  it("is disabled while the period is still running", () => {
    expect(canFinalise("2026-11-01", now)).toBe(false);
  });
  it("is enabled once the exclusive end is today or earlier", () => {
    expect(canFinalise("2026-10-14", now)).toBe(true);
    expect(canFinalise("2026-10-01", now)).toBe(true);
  });
  const period = { from: "2026-09-01", to: "2026-10-01", periodEndInclusive: "2026-09-30" };
  it("is disabled when already finalised, pending, or no data", () => {
    expect(finaliseEnabled({ period, finalised: null }, false, now)).toBe(true);
    expect(finaliseEnabled({ period, finalised: null }, true, now)).toBe(false);
    expect(finaliseEnabled(undefined, false, now)).toBe(false);
    const finalised = { id: "s" } as StatementResult["finalised"];
    expect(finaliseEnabled({ period, finalised }, false, now)).toBe(false);
  });
});

describe("groupLines", () => {
  const lines: StatementLine[] = [
    { type: "booking", bookingId: "b1", transactionId: "t1", clientName: "A", dateCreated: null, commission: "100.00", discounts: "0.00", serviceCharge: "0.00", net: "100.00" },
    { type: "upsell", bookingId: "b1", transactionId: "t1", clientName: "A", addedAt: null, upsellType: "Transfer", amount: "10.00" },
    { type: "booking", bookingId: "b2", transactionId: "t2", clientName: null, dateCreated: null, commission: "50.00", discounts: "5.00", serviceCharge: "0.00", net: "45.00" },
  ];
  it("splits bookings and upsells preserving order", () => {
    const g = groupLines(lines);
    expect(g.bookings.map((l) => l.bookingId)).toEqual(["b1", "b2"]);
    expect(g.upsells.map((l) => l.upsellType)).toEqual(["Transfer"]);
  });
  it("handles empty input", () => {
    expect(groupLines([])).toEqual({ bookings: [], upsells: [] });
  });
});

describe("frozen figures and drift", () => {
  const base: StatementResult = {
    branch: { id: "b", name: "HW", ownerUserId: null, profitSharePercent: "70" },
    period: { from: "2026-09-01", to: "2026-10-01", periodEndInclusive: "2026-09-30" },
    gross: "200.00",
    liveGross: "200.00",
    driftWarning: false,
    sharePercent: "70.00",
    homeworkerShare: "140.00",
    orgShare: "60.00",
    bookingCount: 2,
    lines: [],
    finalised: null,
  };
  it("shows top-level figures, not frozen, when not finalised", () => {
    expect(displayFigures(base)).toMatchObject({ gross: "200.00", frozen: false });
  });
  it("uses the top-level (already frozen) figures and flags finalised", () => {
    const r: StatementResult = {
      ...base,
      gross: "150.00",
      sharePercent: "60.00",
      homeworkerShare: "90.00",
      liveGross: "200.00",
      driftWarning: true,
      finalised: {
        id: "s", periodStart: "2026-09-01", periodEnd: "2026-10-01", grossProfit: "999.00", sharePercent: "1.00",
        homeworkerShare: "1.00", orgShare: "1.00", status: "final", finalisedAt: null,
      },
    };
    expect(displayFigures(r)).toEqual({ gross: "150.00", sharePercent: "60.00", homeworkerShare: "90.00", orgShare: "60.00", frozen: true });
  });
  it("builds the drift warning only when flagged", () => {
    expect(driftMessage({ driftWarning: false, liveGross: "1" })).toBeNull();
    expect(driftMessage({ driftWarning: true, liveGross: "200.00" })).toContain("live gross");
    expect(driftMessage({ driftWarning: true, liveGross: "200.00" })).toContain("200.00");
  });
});

describe("formatMoney", () => {
  it("formats decimal strings and dashes missing values", () => {
    expect(formatMoney("12.5")).toContain("12.50");
    expect(formatMoney(null)).toBe("–");
    expect(formatMoney("abc")).toBe("–");
  });
});
