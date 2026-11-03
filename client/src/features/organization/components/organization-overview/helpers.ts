export const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export const currencyFull = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMonthLabel(yyyyDashMm: string): string {
  const [y, m] = yyyyDashMm.split("-").map((n) => parseInt(n, 10));
  if (!y || !m) return yyyyDashMm;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export type OverviewBranchKind = "shop" | "homeworker";

/**
 * True when an overview row belongs to a homeworker. Prefers the server's
 * `branchType`; falls back to the legacy `isHomeworker` flag when it is absent.
 */
export function isHomeworkerRow(row: { branchType?: OverviewBranchKind | null; isHomeworker?: boolean }): boolean {
  if (row.branchType) return row.branchType === "homeworker";
  return row.isHomeworker === true;
}

export type OverviewRowFilter = "all" | "branches" | "homeworkers";

export function filterOverviewRows<T extends { branchType?: OverviewBranchKind | null; isHomeworker?: boolean }>(
  rows: T[],
  filter: OverviewRowFilter,
): T[] {
  if (filter === "branches") return rows.filter((r) => !isHomeworkerRow(r));
  if (filter === "homeworkers") return rows.filter(isHomeworkerRow);
  return rows;
}
