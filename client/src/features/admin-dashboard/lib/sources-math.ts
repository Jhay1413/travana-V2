import type { LeadSourceKey, ProfitSourceRow } from "../types";

export type SourceMeasure = "profit" | "bookings";

const TILES: Record<LeadSourceKey, string> = {
  SHOP: "SH",
  FACEBOOK: "FB",
  WHATSAPP: "WA",
  INSTAGRAM: "IG",
  PHONE_ENQUIRY: "PH",
  none: "–",
};

export function sourceTile(key: LeadSourceKey | string): string {
  return (TILES as Record<string, string>)[key] ?? key.slice(0, 2).toUpperCase();
}

/** Rows ordered by the chosen measure, the other measure breaking ties. */
export function sortSources(rows: ProfitSourceRow[], by: SourceMeasure): ProfitSourceRow[] {
  const other: SourceMeasure = by === "profit" ? "bookings" : "profit";
  return [...rows].sort((a, b) => b[by] - a[by] || b[other] - a[other] || a.label.localeCompare(b.label));
}

/** Whole-number share of the total, 0 when the total is 0. */
export function share(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

/** Bar width as a percentage of the largest value. */
export function barWidth(value: number, max: number): number {
  return max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
}

export function maxOf(rows: ProfitSourceRow[], by: SourceMeasure): number {
  return rows.reduce((m, r) => Math.max(m, r[by]), 0);
}
