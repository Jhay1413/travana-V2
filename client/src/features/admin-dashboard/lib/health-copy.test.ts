import { describe, expect, it } from "vitest";
import { closeDeltaText, closeRatePct, commissionRate, projectedSales, rateBarPct, viewsPerQuote, viewsSub } from "./health-copy";

describe("health-copy", () => {
  it("shows views per quote to one decimal", () => {
    expect(viewsPerQuote(7, 3)).toBe("2.3");
    expect(viewsPerQuote(5, 0)).toBe("0");
    expect(viewsSub(0, 0)).toBe("From 0 quotes sent, so 0 views per quote");
    expect(viewsSub(6, 1)).toBe("From 1 quote sent, so 6.0 views per quote");
  });

  it("clamps the close rate at 100", () => {
    expect(closeRatePct(14, 44)).toBe(32);
    expect(closeRatePct(5, 2)).toBe(100);
    expect(closeRatePct(5, 0)).toBe(0);
  });

  it("words the weekly delta", () => {
    expect(closeDeltaText(32.2, 31.8)).toBe("Unchanged from last week");
    expect(closeDeltaText(35, 33)).toBe("Up 2 points on last week");
    expect(closeDeltaText(34, 33)).toBe("Up 1 point on last week");
    expect(closeDeltaText(20, 33)).toBe("Down 13 points on last week");
  });

  it("computes the commission rate and its bar", () => {
    expect(commissionRate(2769, 37370)).toBeCloseTo(7.41, 2);
    expect(commissionRate(10, 0)).toBe(0);
    expect(rateBarPct(6.25)).toBe(50);
    expect(rateBarPct(30)).toBe(100);
  });

  it("projects open sales with the close rate", () => {
    expect(projectedSales(123167, 32)).toBeCloseTo(39413.44, 2);
  });
});
