import type { DepartureRow, DeparturesTab } from "../types";

export const TICKETS_PATH = "/agency/departures";
export const BALANCES_PATH = "/agency/departures/balances";

export function tabPath(tab: DeparturesTab): string {
  return tab === "tickets" ? TICKETS_PATH : BALANCES_PATH;
}

export function tabFromPath(path: string): DeparturesTab {
  return path.replace(/\/+$/, "").endsWith("/balances") ? "balances" : "tickets";
}

/** The other tab, wrapping around (Left and Right arrow keys). */
export function adjacentTab(tab: DeparturesTab): DeparturesTab {
  return tab === "tickets" ? "balances" : "tickets";
}

export interface TabCounts {
  tickets: number;
  balances: number;
}

/** Tab badges: trips not completed, bookings not fully paid. */
export function tabCounts(rows: DepartureRow[]): TabCounts {
  return {
    tickets: rows.filter((r) => !r.checks.completed).length,
    balances: rows.filter((r) => !r.checks.fullyPaid).length,
  };
}

/** Branch managers' dashboard is "Dashboard" at /branch-overview; admins' is "Admin Dashboard". */
export function breadcrumbRoot(isAdmin: boolean): { label: string; href: string } {
  return isAdmin ? { label: "Admin Dashboard", href: "/agency/overview" } : { label: "Dashboard", href: "/branch-overview" };
}
