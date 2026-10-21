import type { OrgOperatorRow } from "../types";

export interface OperatorSummary {
  count: number;
  /** One decimal, e.g. "9.8", or "—" when no rate is set. */
  average: string;
  /** e.g. "12.5%" or "—". */
  highest: string;
  highestName: string;
}

export function rateOf(row: OrgOperatorRow): number | null {
  if (row.commission_percentage === null || row.commission_percentage === "") return null;
  const n = Number(row.commission_percentage);
  return Number.isFinite(n) ? n : null;
}

export function summarise(rows: OrgOperatorRow[]): OperatorSummary {
  const rated = rows.flatMap((r) => {
    const v = rateOf(r);
    return v === null ? [] : [{ name: r.name, v }];
  });
  if (rated.length === 0) return { count: rows.length, average: "—", highest: "—", highestName: "None yet" };
  const mean = rated.reduce((sum, r) => sum + r.v, 0) / rated.length;
  const best = rated.reduce((a, b) => (b.v > a.v ? b : a));
  return { count: rows.length, average: mean.toFixed(1), highest: `${best.v}%`, highestName: best.name };
}
