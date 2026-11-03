import type { OrganizationOverviewKpis } from "@/features/organization/api/organization-overview.api";
import { gbp, perBooking } from "./money";

/** Profit per booking = this month's profit (incl. upsells) / this month's bookings. */
export function ppbFromKpis(kpis: Pick<OrganizationOverviewKpis, "monthCommission" | "monthBookingsCount">): number {
  return perBooking(kpis.monthCommission, kpis.monthBookingsCount);
}

export function targetPct(commission: number, target: number): number {
  return target > 0 ? Math.round((commission / target) * 100) : 0;
}

export function remainingToTarget(commission: number, target: number): number {
  return Math.max(0, target - commission);
}

/** Bookings still needed at the given profit per booking; null when there is no PPB to estimate with. */
export function bookingsToTarget(remaining: number, ppb: number): number | null {
  return ppb > 0 ? Math.ceil(remaining / ppb) : null;
}

export interface TargetSummary {
  kind: "none" | "reached" | "progress";
  pct: number;
  /** Bold lead such as "28%" (progress only). */
  lead: string;
  /** Text shown after the lead (or the whole text when there is no lead). */
  text: string;
}

export function targetSummary(input: { target: number; commission: number; ppb: number }): TargetSummary {
  const { target, commission, ppb } = input;
  if (!(target > 0)) return { kind: "none", pct: 0, lead: "", text: "No target set" };
  const pct = targetPct(commission, target);
  const remaining = remainingToTarget(commission, target);
  if (remaining <= 0) return { kind: "reached", pct, lead: "", text: "Target reached" };
  const needed = bookingsToTarget(remaining, ppb);
  const tail = needed === null ? "" : `, about ${needed} more ${needed === 1 ? "booking" : "bookings"} at ${gbp(ppb)} each`;
  return { kind: "progress", pct, lead: `${pct}%`, text: ` reached · ${gbp(remaining)} still to make${tail}` };
}

export function bookingWord(n: number): string {
  return n === 1 ? "booking" : "bookings";
}

/** "From 6 bookings this week", split so the count can be bold. */
export function fromBookings(count: number, when: string): { lead: string; count: number; tail: string } {
  return { lead: "From ", count, tail: ` ${bookingWord(count)} ${when}` };
}
