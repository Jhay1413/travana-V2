import type { DepartureRow } from "../types";
import { daysAway } from "./day-labels";
import { ALL_OPTION, byTravelThenName, matchesQuery, type ListEmpty } from "./ticket-rows";

export type BalanceShow = "unpaid" | "paid" | "all";

export interface BalanceFilters {
  show: BalanceShow;
  query: string;
  /** Supplier (tour operator) name, or "all". */
  supplier: string;
}

export function filterBalances(rows: DepartureRow[], f: BalanceFilters): DepartureRow[] {
  return rows
    .filter((r) => (f.show === "all" ? true : f.show === "paid" ? r.checks.fullyPaid : !r.checks.fullyPaid))
    .filter((r) => f.supplier === ALL_OPTION || r.operatorName === f.supplier)
    .filter((r) => matchesQuery(f.query, r.haysRef, r.leadPassenger, r.destination, r.operatorName, r.supplierRef))
    .sort(byTravelThenName);
}

export interface BalanceCounts {
  total: number;
  paid: number;
  unpaid: number;
  /** Not paid and departing within 7 days. */
  soon: number;
}

export function balanceCounts(rows: DepartureRow[], today: string): BalanceCounts {
  const paid = rows.filter((r) => r.checks.fullyPaid).length;
  return {
    total: rows.length,
    paid,
    unpaid: rows.length - paid,
    soon: rows.filter((r) => !r.checks.fullyPaid && daysAway(r.travelDate, today) <= 7).length,
  };
}

/** "10 bookings · 3 fully paid · 7 still to pay, 4 of them departing in the next 7 days" */
export function balanceStatusLine(c: BalanceCounts): string {
  return `${c.total} ${c.total === 1 ? "booking" : "bookings"} · ${c.paid} fully paid · ${c.unpaid} still to pay, ${c.soon} of them departing in the next 7 days`;
}

export function balanceEmpty(f: BalanceFilters): ListEmpty {
  const clean = f.show === "unpaid" && !f.query.trim() && f.supplier === ALL_OPTION;
  return clean
    ? { title: "Everything is paid", hint: "Every booking in the list is fully paid." }
    : { title: "No bookings match", hint: "Try another search or supplier." };
}

export type PaidPillTone = "good" | "warn" | "plain";

/** The pill under the Fully paid tick: Paid / Not paid (amber when leaving within 7 days). */
export function paidPill(paid: boolean, days: number): { label: string; tone: PaidPillTone } {
  if (paid) return { label: "Paid", tone: "good" };
  return { label: "Not paid", tone: days <= 7 ? "warn" : "plain" };
}
