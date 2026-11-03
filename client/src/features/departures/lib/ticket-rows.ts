import type { DepartureRow } from "../types";
import { daysAway } from "./day-labels";

export type TicketShow = "todo" | "done" | "all";

export interface TicketFilters {
  show: TicketShow;
  query: string;
  /** Operator name, or "all". */
  operator: string;
}

export const ALL_OPTION = "all";

/** Case-insensitive "contains" over any of the fields; an empty query matches everything. */
export function matchesQuery(query: string, ...fields: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  return !q || fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/** Distinct, sorted non-empty values. */
export function distinctSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ""))].sort((a, b) => a.localeCompare(b));
}

/** Travel date first, then client name. */
export function byTravelThenName(a: DepartureRow, b: DepartureRow): number {
  return a.travelDate.localeCompare(b.travelDate) || a.clientName.localeCompare(b.clientName);
}

export function filterTickets(rows: DepartureRow[], f: TicketFilters): DepartureRow[] {
  return rows
    .filter((r) => (f.show === "all" ? true : f.show === "done" ? r.checks.completed : !r.checks.completed))
    .filter((r) => f.operator === ALL_OPTION || r.operatorName === f.operator)
    .filter((r) => matchesQuery(f.query, r.haysRef, r.clientName, r.destination, r.operatorName))
    .sort(byTravelThenName);
}

export interface TicketCounts {
  total: number;
  done: number;
  todo: number;
  noPassport: number;
  /** Not complete and leaving within 3 days. */
  leavingSoon: number;
}

export function ticketCounts(rows: DepartureRow[], today: string): TicketCounts {
  const done = rows.filter((r) => r.checks.completed).length;
  return {
    total: rows.length,
    done,
    todo: rows.length - done,
    noPassport: rows.filter((r) => !r.checks.completed && !r.checks.passportInfo).length,
    leavingSoon: rows.filter((r) => !r.checks.completed && daysAway(r.travelDate, today) <= 3).length,
  };
}

/** "12 departures · 1 completed · 6 still need passport info · 2 leave in the next 3 days and are not complete" */
export function ticketStatusLine(c: TicketCounts): string {
  const leaves = c.leavingSoon === 1 ? "leaves" : "leave";
  const is = c.leavingSoon === 1 ? "is" : "are";
  return `${c.total} ${c.total === 1 ? "departure" : "departures"} · ${c.done} completed · ${c.noPassport} still need passport info · ${c.leavingSoon} ${leaves} in the next 3 days and ${is} not complete`;
}

export interface ListEmpty {
  title: string;
  hint: string;
}

/** Empty-state copy. "Everything is done" only when the default view has nothing and no filter is on. */
export function ticketEmpty(f: TicketFilters): ListEmpty {
  const clean = f.show === "todo" && !f.query.trim() && f.operator === ALL_OPTION;
  return clean
    ? { title: "Everything is done", hint: "Every departure in the list is completed." }
    : { title: "No trips match", hint: "Try another search or tour operator." };
}
