import { describe, expect, it } from "vitest";
import { buildChartMonths, niceAxis } from "./chart-model";

const CURRENT = { year: 2026, month: 10 };

function point(month: string, commission: number, target: number) {
  return { month: `2026-${month}`, commission, bookings: 0, target };
}

describe("chart-model", () => {
  const months = buildChartMonths(
    [
      point("03", 5600, 0),
      point("06", 15900, 15000),
      point("08", 7400, 9500),
      point("09", 11000, 11000),
      point("10", 2769, 10000),
      point("11", 0, 10000),
      point("12", 0, 0),
    ],
    CURRENT,
  );
  const by = (name: string) => months.find((m) => m.name === name)!;

  it("classifies the bars", () => {
    expect(by("Mar").kind).toBe("none");
    expect(by("Jun").kind).toBe("on");
    expect(by("Aug").kind).toBe("under");
    expect(by("Oct").kind).toBe("under");
  });

  it("words the result pill", () => {
    expect(by("Mar").result).toBe("No target set");
    expect(by("Jun").result).toBe("£900 over");
    expect(by("Sep").result).toBe("On target");
    expect(by("Aug").result).toBe("£2,100 under");
    expect(by("Nov").result).toBe("Upcoming");
    expect(by("Dec").result).toBe("Upcoming");
  });

  it("shows Not yet for upcoming months and None for no target", () => {
    expect(by("Nov").commissionText).toBe("Not yet");
    expect(by("Oct").commissionText).toBe("£2,769");
    expect(by("Mar").targetText).toBe("None");
    expect(by("Jun").targetText).toBe("£15,000");
  });

  it("writes the tooltip", () => {
    expect(by("Jun").tooltip).toBe("Jun: £15,900 commission, target £15,000, on or over target");
    expect(by("Aug").tooltip).toBe("Aug: £7,400 commission, target £9,500, under target by £2,100");
    expect(by("Mar").tooltip).toBe("Mar: £5,600 commission, no target set");
    expect(by("Nov").tooltip).toBe("Nov: no commission yet, target £10,000");
  });

  it("only draws bars where there is commission", () => {
    expect(by("Nov").hasBar).toBe(false);
    expect(by("Jun").hasBar).toBe(true);
    expect(by("Dec").hasTarget).toBe(false);
  });

  it("rounds the axis to four tidy steps", () => {
    expect(niceAxis(15900)).toEqual({ max: 20000, ticks: [0, 5000, 10000, 15000, 20000] });
    expect(niceAxis(15000).max).toBe(20000);
    expect(niceAxis(3700).ticks).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(niceAxis(0).max).toBeGreaterThan(0);
  });
});
