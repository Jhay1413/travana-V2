import { plural } from "./money";

/** Industry benchmark commission rate the Average commission rate bar is scaled to. */
export const BENCHMARK_COMMISSION_RATE = 12.5;

export function viewsPerQuote(views: number, quotesSent: number): string {
  return quotesSent > 0 ? (views / quotesSent).toFixed(1) : "0";
}

export function viewsSub(views: number, quotesSent: number): string {
  return `From ${plural(quotesSent, "quote")} sent, so ${viewsPerQuote(views, quotesSent)} views per quote`;
}

/** Bookings vs quotes created in the same month (not a cohort), so clamped at 100%. */
export function closeRatePct(monthBookings: number, monthQuotes: number): number {
  return monthQuotes > 0 ? Math.min(100, Math.round((monthBookings / monthQuotes) * 100)) : 0;
}

export function closeDeltaText(weekRate: number, prevWeekRate: number): string {
  const delta = Math.round(weekRate) - Math.round(prevWeekRate);
  if (delta === 0) return "Unchanged from last week";
  const n = Math.abs(delta);
  return `${delta > 0 ? "Up" : "Down"} ${n} ${n === 1 ? "point" : "points"} on last week`;
}

export function commissionRate(commission: number, sales: number): number {
  return sales > 0 ? (commission / sales) * 100 : 0;
}

export function rateBarPct(rate: number): number {
  return Math.min(100, Math.max(0, (rate / BENCHMARK_COMMISSION_RATE) * 100));
}

export function projectedSales(openValue: number, closeRate: number): number {
  return (openValue * closeRate) / 100;
}
