import { describe, expect, it } from "vitest";
import { currency } from "../components/helpers";
import { computeTargetStats } from "./tile-math";

describe("computeTargetStats", () => {
  it("computes percentage, remaining and the pace text", () => {
    const s = computeTargetStats({ monthProfit: 2500, target: 10000, monthAvgBookingValue: 500 });
    expect(s.pct).toBe(25);
    expect(s.toTargetPct).toBe(75);
    expect(s.barPct).toBe(25);
    expect(s.remaining).toBe(7500);
    expect(s.bookingsToTarget).toBe(15);
    expect(s.runToTargetText).toBe(`15 Bookings at ${currency.format(500)}ppb`);
  });

  it("uses the singular word for one booking", () => {
    const s = computeTargetStats({ monthProfit: 9600, target: 10000, monthAvgBookingValue: 500 });
    expect(s.runToTargetText).toBe(`1 Booking at ${currency.format(500)}ppb`);
  });

  it("falls back to the overall average when there are no bookings this month", () => {
    const s = computeTargetStats({ monthProfit: 0, target: 1000, monthAvgBookingValue: 0, avgBookingValue: 250 });
    expect(s.ppb).toBe(250);
    expect(s.bookingsToTarget).toBe(4);
  });

  it("says no bookings yet when there is nothing to estimate from", () => {
    const s = computeTargetStats({ monthProfit: 0, target: 1000 });
    expect(s.runToTargetText).toBe("No bookings yet to estimate");
    expect(s.bookingsToTarget).toBe(0);
  });

  it("reports the target as reached and caps the bar", () => {
    const s = computeTargetStats({ monthProfit: 12000, target: 10000, monthAvgBookingValue: 500 });
    expect(s.reached).toBe(true);
    expect(s.pct).toBe(120);
    expect(s.toTargetPct).toBe(0);
    expect(s.barPct).toBe(100);
    expect(s.remaining).toBe(0);
    expect(s.runToTargetText).toBe("Target reached");
  });

  it("handles no target", () => {
    const s = computeTargetStats({ monthProfit: 500, target: 0, monthAvgBookingValue: 100 });
    expect(s.hasTarget).toBe(false);
    expect(s.reached).toBe(false);
    expect(s.pct).toBe(0);
    expect(s.runToTargetText).toBe("No target set");
  });
});
