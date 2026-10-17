import { currency } from "../components/helpers";

export interface TargetInput {
  monthProfit: number;
  target: number;
  /** Average booking value this month (preferred for pace). */
  monthAvgBookingValue?: number;
  /** Fallback average when there are no bookings this month. */
  avgBookingValue?: number;
}

export interface TargetStats {
  hasTarget: boolean;
  reached: boolean;
  /** Share of the target already earned, rounded, may exceed 100. */
  pct: number;
  /** Share still to earn, never negative. */
  toTargetPct: number;
  /** Fill width for the bar, 0..100. */
  barPct: number;
  remaining: number;
  /** Profit per booking used for the pace estimate. */
  ppb: number;
  bookingsToTarget: number;
  runToTargetText: string;
}

export function bookingWord(count: number): string {
  return count === 1 ? "Booking" : "Bookings";
}

export function upsellWord(count: number): string {
  return count === 1 ? "Upsell" : "Upsells";
}

export function computeTargetStats(input: TargetInput): TargetStats {
  const { monthProfit, target } = input;
  const hasTarget = target > 0;
  const pct = hasTarget ? Math.round((monthProfit / target) * 100) : 0;
  const remaining = Math.max(0, target - monthProfit);
  const monthAvg = input.monthAvgBookingValue ?? 0;
  const ppb = Math.round(monthAvg > 0 ? monthAvg : (input.avgBookingValue ?? 0));
  const bookingsToTarget = ppb > 0 ? Math.ceil(remaining / ppb) : 0;
  const reached = hasTarget && remaining <= 0;

  let runToTargetText: string;
  if (!hasTarget) runToTargetText = "No target set";
  else if (reached) runToTargetText = "Target reached";
  else if (ppb <= 0) runToTargetText = "No bookings yet to estimate";
  else runToTargetText = `${bookingsToTarget} ${bookingWord(bookingsToTarget)} at ${currency.format(ppb)}ppb`;

  return {
    hasTarget,
    reached,
    pct,
    toTargetPct: Math.max(0, 100 - pct),
    barPct: Math.min(Math.max(pct, 0), 100),
    remaining,
    ppb,
    bookingsToTarget,
    runToTargetText,
  };
}
