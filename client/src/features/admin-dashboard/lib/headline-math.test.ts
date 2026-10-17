import { describe, expect, it } from "vitest";
import { bookingsToTarget, fromBookings, ppbFromKpis, remainingToTarget, targetPct, targetSummary } from "./headline-math";

describe("headline-math", () => {
  it("derives PPB from month profit and bookings", () => {
    expect(ppbFromKpis({ monthCommission: 2769, monthBookingsCount: 14 })).toBeCloseTo(197.79, 2);
    expect(ppbFromKpis({ monthCommission: 0, monthBookingsCount: 0 })).toBe(0);
  });

  it("computes percentage and remainder", () => {
    expect(targetPct(2769, 10000)).toBe(28);
    expect(targetPct(100, 0)).toBe(0);
    expect(remainingToTarget(2769, 10000)).toBe(7231);
    expect(remainingToTarget(12000, 10000)).toBe(0);
  });

  it("rounds bookings to target up and returns null without a PPB", () => {
    expect(bookingsToTarget(7231, 181)).toBe(40);
    expect(bookingsToTarget(7231, 0)).toBeNull();
  });

  it("says when there is no target", () => {
    expect(targetSummary({ target: 0, commission: 500, ppb: 100 })).toMatchObject({ kind: "none", text: "No target set" });
  });

  it("says when the target is reached", () => {
    expect(targetSummary({ target: 1000, commission: 1000, ppb: 100 })).toMatchObject({ kind: "reached", text: "Target reached" });
  });

  it("describes progress with the estimate", () => {
    const s = targetSummary({ target: 10000, commission: 2769, ppb: 181 });
    expect(s.kind).toBe("progress");
    expect(s.lead).toBe("28%");
    expect(s.text).toBe(" reached · £7,231 still to make, about 40 more bookings at £181 each");
  });

  it("uses the singular and drops the estimate when PPB is 0", () => {
    expect(targetSummary({ target: 1000, commission: 900, ppb: 100 }).text).toContain("about 1 more booking at");
    expect(targetSummary({ target: 1000, commission: 0, ppb: 0 }).text).toBe(" reached · £1,000 still to make");
  });

  it("words the bookings sub", () => {
    expect(fromBookings(1, "today")).toEqual({ lead: "From ", count: 1, tail: " booking today" });
    expect(fromBookings(0, "this week").tail).toBe(" bookings this week");
  });
});
