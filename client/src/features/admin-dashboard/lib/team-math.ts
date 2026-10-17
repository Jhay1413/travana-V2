import type {
  AgentPerformanceRow,
  AgentsPerformanceUnlisted,
} from "@/features/organization/api/organization-overview.api";
import { filterOverviewRows, isHomeworkerRow } from "@/features/organization/components/organization-overview/helpers";
import { perBooking } from "./money";

export type TeamFilter = "all" | "shop" | "homeworkers" | `branch:${string}`;

export interface TeamFilterOption {
  value: TeamFilter;
  label: string;
}

/** Profit per booking for a row: the server's figure when sent, else month profit / month bookings. */
export function rowPpb(row: Pick<AgentPerformanceRow, "ppb" | "month" | "rangeBookings">): number {
  return row.ppb ?? perBooking(row.month, row.rangeBookings);
}

export function toGo(target: number, month: number): number {
  return Math.max(0, target - month);
}

export function targetProgressPct(target: number, month: number): number {
  return target > 0 ? Math.round((month / target) * 100) : 0;
}

export interface TeamTotals {
  today: number;
  week: number;
  month: number;
  bookings: number;
  /** Total month profit / total bookings. */
  avg: number;
  target: number;
  toGo: number;
  /** Null when no row carries an open-deals figure. */
  openDeals: number | null;
}

export function teamTotals(
  rows: AgentPerformanceRow[],
  unlisted: AgentsPerformanceUnlisted | undefined,
  includeUnlisted: boolean,
): TeamTotals {
  const extra = includeUnlisted && unlisted ? unlisted : { today: 0, week: 0, month: 0, rangeBookings: 0 };
  const sum = (fn: (r: AgentPerformanceRow) => number) => rows.reduce((s, r) => s + fn(r), 0);
  const month = sum((r) => r.month) + extra.month;
  const bookings = sum((r) => r.rangeBookings) + extra.rangeBookings;
  const target = sum((r) => r.target);
  const hasOpen = rows.some((r) => r.openDeals !== undefined);
  return {
    today: sum((r) => r.today) + extra.today,
    week: sum((r) => r.week) + extra.week,
    month,
    bookings,
    avg: perBooking(month, bookings),
    target,
    // Each agent's own shortfall; profit from agents without a target never offsets others.
    toGo: rows.reduce((t, r) => t + (r.target > 0 ? toGo(r.target, r.month) : 0), 0),
    openDeals: hasOpen ? sum((r) => r.openDeals ?? 0) : null,
  };
}

/** The "Other / unassigned" row is only shown for the unfiltered team and when it carries profit. */
export function showUnlistedRow(unlisted: AgentsPerformanceUnlisted | undefined, filter: TeamFilter): boolean {
  if (!unlisted || filter !== "all") return false;
  return unlisted.today !== 0 || unlisted.week !== 0 || unlisted.month !== 0;
}

export function teamFilterOptions(
  branches: Array<{ id: string; name: string; branchType?: string }>,
  pageBranchSelected: boolean,
): TeamFilterOption[] {
  const options: TeamFilterOption[] = [
    { value: "all", label: pageBranchSelected ? "Everyone" : "All branches" },
    { value: "shop", label: "Shop staff" },
  ];
  if (!pageBranchSelected) {
    for (const b of branches) {
      if (b.branchType === "homeworker") continue;
      options.push({ value: `branch:${b.id}`, label: b.name });
    }
  }
  options.push({ value: "homeworkers", label: "Homeworkers" });
  return options;
}

/** A branch picked in the team filter re-queries the server; otherwise the page selector decides. */
export function teamBranchId(pageBranchId: string | undefined, filter: TeamFilter): string | undefined {
  if (filter.startsWith("branch:")) return filter.slice("branch:".length);
  return pageBranchId;
}

/** Homeworker filtering is client-side; branch filters are applied by the server query. */
export function filterTeamRows(rows: AgentPerformanceRow[], filter: TeamFilter): AgentPerformanceRow[] {
  if (filter === "homeworkers") return filterOverviewRows(rows, "homeworkers");
  if (filter === "shop") return filterOverviewRows(rows, "branches");
  return rows;
}

/** The line under an agent's name. */
export function rowBranchLabel(row: Pick<AgentPerformanceRow, "branches" | "branchType" | "isHomeworker">): string {
  if (isHomeworkerRow(row)) return "Homeworker";
  const names = (row.branches ?? []).map((b) => b.name);
  return names.length > 0 ? names.join(", ") : "No branch";
}
