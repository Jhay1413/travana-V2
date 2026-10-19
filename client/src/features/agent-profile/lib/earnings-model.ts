import type { AgentProfileHeader, AgentProfilePerformance } from "../types";
import { dayKeyOf, formatDay } from "./dates";
import { gbp, plural } from "./money";
import { sharePct } from "./chart-model";

export interface EarningsTile {
  label: string;
  value: string;
  sub: string;
}

export const HIDDEN_PAY_SUB = "Only owners and admins can see pay";

function fromBookings(bookings: number): string {
  return `From ${plural(bookings, "booking")}`;
}

/** "Of the agency's £4,100 in this period" (or the branch's), or a plain line when nothing was made. */
export function shareSub(perf: AgentProfilePerformance): string {
  const word = comparatorNoun(perf);
  return perf.comparator.profit > 0
    ? `Of the ${word}'s ${gbp(perf.comparator.profit)} in this period`
    : `The ${word} made no profit in this period`;
}

/** "agency" for admins, "branch" for branch managers: whichever the share is measured against. */
export function comparatorNoun(perf: AgentProfilePerformance): string {
  return perf.comparator.scope === "organisation" ? "agency" : "branch";
}

function shareValue(perf: AgentProfilePerformance): string {
  const share = sharePct(perf.profit, perf.comparator.profit);
  return share === null ? "—" : `${share}%`;
}

/**
 * The three tiles on the Earnings tab. Employees show what they earned for the company; homeworkers
 * show profit booked and, for viewers who may see pay, the split. Pay is never computed for others.
 */
export function buildEarningsTiles(header: AgentProfileHeader, perf: AgentProfilePerformance): EarningsTile[] {
  const first = header.user.firstName;
  if (!header.isHomeworker) {
    return [
      { label: "Profit earned for the company", value: gbp(perf.profit), sub: fromBookings(perf.bookings) },
      { label: `Share of ${comparatorNoun(perf)} profit`, value: shareValue(perf), sub: shareSub(perf) },
      {
        label: "Earned since they started",
        value: gbp(header.lifetimeProfit),
        sub: `Since ${formatDay(dayKeyOf(header.startedAt))}`,
      },
    ];
  }
  const booked: EarningsTile = { label: "Profit booked", value: gbp(perf.profit), sub: fromBookings(perf.bookings) };
  const share = header.viewer.canSeePay ? (header.homeworker?.profitSharePercent ?? null) : null;
  if (!header.viewer.canSeePay) {
    return [
      booked,
      { label: `Share of ${comparatorNoun(perf)} profit`, value: shareValue(perf), sub: shareSub(perf) },
      { label: "Pay and payouts", value: "Hidden", sub: HIDDEN_PAY_SUB },
    ];
  }
  if (share === null) {
    return [
      booked,
      { label: `Paid out to ${first}`, value: "—", sub: "No profit share set yet" },
      { label: "Kept by the agency", value: "—", sub: "No profit share set yet" },
    ];
  }
  const paid = (perf.profit * share) / 100;
  return [
    booked,
    { label: `Paid out to ${first}`, value: gbp(paid), sub: `${share}% of the profit booked` },
    { label: "Kept by the agency", value: gbp(perf.profit - paid), sub: `${100 - share}% of the profit booked` },
  ];
}
