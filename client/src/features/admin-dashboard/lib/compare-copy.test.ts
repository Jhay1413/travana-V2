import { describe, expect, it } from "vitest";
import { againstOptions, changeText, compareSentence, formatMeasure } from "./compare-copy";

describe("compare-copy", () => {
  it("offers the right comparisons per period", () => {
    expect(againstOptions("week").map((o) => o.label)).toEqual(["Last week", "Last year"]);
    expect(againstOptions("month").map((o) => o.label)).toEqual(["Last month", "Last year"]);
    expect(againstOptions("year").map((o) => [o.value, o.label])).toEqual([
      ["prev", "Last year"],
      ["two_years", "Two years ago"],
    ]);
  });

  it("writes an ahead sentence with the percentage", () => {
    expect(compareSentence("month", 3240, 3180, "Same point last month")).toBe(
      "Profit this month is £60 (2%) ahead of the same point last month.",
    );
  });

  it("writes a behind sentence", () => {
    expect(compareSentence("week", 610, 743, "Same point last week")).toBe(
      "Profit this week is £133 (18%) behind the same point last week.",
    );
  });

  it("writes a level sentence", () => {
    expect(compareSentence("year", 500.4, 500.1, "Same point last year")).toBe("Profit this year is level with the same point last year.");
  });

  it("omits the percentage when the other period is zero", () => {
    expect(compareSentence("month", 400, 0, "Same point last year")).toBe("Profit this month is £400 ahead of the same point last year.");
  });

  it("omits a percentage that rounds to zero", () => {
    expect(compareSentence("year", 100200, 100000, "Same point last year")).toBe("Profit this year is £200 ahead of the same point last year.");
    expect(changeText("profit", 100200, 100000)).toEqual({ text: "Up £200", tone: "up" });
  });

  it("formats each measure", () => {
    expect(formatMeasure("profit", 2769.4)).toBe("£2,769");
    expect(formatMeasure("bookings", 14)).toBe("14");
    expect(formatMeasure("ppb", 197.79)).toBe("£198");
    expect(formatMeasure("closeRate", 31.6)).toBe("32%");
  });

  it("words the change per measure", () => {
    expect(changeText("profit", 2769, 3180)).toEqual({ text: "Down £411 (13%)", tone: "down" });
    expect(changeText("profit", 3240, 3180)).toEqual({ text: "Up £60 (2%)", tone: "up" });
    expect(changeText("profit", 100, 0)).toEqual({ text: "Up £100", tone: "up" });
    expect(changeText("bookings", 14, 16)).toEqual({ text: "Down 2", tone: "down" });
    expect(changeText("ppb", 198, 199)).toEqual({ text: "Down £1", tone: "down" });
    expect(changeText("closeRate", 34, 32)).toEqual({ text: "Up 2 points", tone: "up" });
    expect(changeText("closeRate", 33, 32)).toEqual({ text: "Up 1 point", tone: "up" });
  });

  it("reports no change on equal displayed values", () => {
    expect(changeText("closeRate", 32.2, 31.9)).toEqual({ text: "No change", tone: "none" });
    expect(changeText("profit", 0, 0)).toEqual({ text: "No change", tone: "none" });
  });
});
