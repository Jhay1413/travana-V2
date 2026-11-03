import type { CompareAgainst, CompareMeasures, ComparePeriod } from "../types";
import { gbp } from "./money";

export type MeasureKey = keyof CompareMeasures;
export type ChangeTone = "up" | "down" | "none";

export const MEASURES: ReadonlyArray<{ key: MeasureKey; label: string }> = [
  { key: "profit", label: "Profit" },
  { key: "bookings", label: "Bookings" },
  { key: "ppb", label: "Profit per booking" },
  { key: "closeRate", label: "Close rate" },
];

export const PERIOD_OPTIONS: ReadonlyArray<{ value: ComparePeriod; label: string }> = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export function againstOptions(period: ComparePeriod): Array<{ value: CompareAgainst; label: string }> {
  if (period === "year") {
    return [
      { value: "prev", label: "Last year" },
      { value: "two_years", label: "Two years ago" },
    ];
  }
  return [
    { value: "prev", label: period === "week" ? "Last week" : "Last month" },
    { value: "year", label: "Last year" },
  ];
}

export function formatMeasure(key: MeasureKey, value: number): string {
  if (key === "bookings") return String(Math.round(value));
  if (key === "closeRate") return `${Math.round(value)}%`;
  return gbp(value);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** "Profit this month is £60 (3%) ahead of the same point last month." */
export function compareSentence(period: ComparePeriod, profitNow: number, profitOther: number, otherLabel: string): string {
  const a = Math.round(profitNow);
  const b = Math.round(profitOther);
  const target = `the ${lowerFirst(otherLabel)}`;
  const d = a - b;
  if (d === 0) return `Profit this ${period} is level with ${target}.`;
  const pctValue = b > 0 ? Math.round((Math.abs(d) / b) * 100) : 0;
  const pct = pctValue > 0 ? ` (${pctValue}%)` : "";
  return `Profit this ${period} is ${gbp(Math.abs(d))}${pct} ${d > 0 ? "ahead of" : "behind"} ${target}.`;
}

/** Change text on the values as displayed (rounded), so the pill always agrees with the two numbers. */
export function changeText(key: MeasureKey, now: number, other: number): { text: string; tone: ChangeTone } {
  const a = Math.round(now);
  const b = Math.round(other);
  const d = a - b;
  if (d === 0) return { text: "No change", tone: "none" };
  const word = d > 0 ? "Up" : "Down";
  const ad = Math.abs(d);
  let text: string;
  const pct = b > 0 ? Math.round((ad / b) * 100) : 0;
  if (key === "profit") text = pct > 0 ? `${word} ${gbp(ad)} (${pct}%)` : `${word} ${gbp(ad)}`;
  else if (key === "bookings") text = `${word} ${ad}`;
  else if (key === "ppb") text = `${word} ${gbp(ad)}`;
  else text = `${word} ${ad} ${ad === 1 ? "point" : "points"}`;
  return { text, tone: d > 0 ? "up" : "down" };
}
