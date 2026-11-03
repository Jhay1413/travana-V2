import { gbp, plural } from "./money";

/** "3 bookings from 12 quotes sent", or just the bookings when no quotes were sent. */
export function bookingsSub(bookings: number, quotesSent: number): string {
  if (quotesSent > 0) return `${plural(bookings, "booking")} from ${plural(quotesSent, "quote")} sent`;
  return bookings === 1 ? "1 booking made" : `${bookings} bookings made`;
}

/** Average profit per booking; null with no bookings. */
export function ppbValue(profit: number, bookings: number): number | null {
  return bookings > 0 ? profit / bookings : null;
}

export interface TargetSummary {
  kind: "none" | "progress";
  pct: number;
  value: string;
  text: string;
}

/** The "Target for this period" tile: value, bar percentage and the sentence under it. */
export function targetSummary(profit: number, target: number): TargetSummary {
  if (!(target > 0)) {
    return { kind: "none", pct: 0, value: "Not set", text: "No target yet. Set one to track progress." };
  }
  const pct = Math.min(100, Math.max(0, Math.round((profit / target) * 100)));
  const rest = profit < target ? `${gbp(target - profit)} still to make` : "target beaten";
  return { kind: "progress", pct, value: gbp(target), text: `${pct}% reached · ${rest}` };
}

/** Sentence above the tiles, e.g. "Showing Tina's figures for this month." */
export function showingLine(firstName: string, say: string): string {
  return `Showing ${firstName}'s figures for ${say}.`;
}
