import { isOpenStage } from "./pipeline-stage-style";
import type { PipelineStage } from "./pipeline-helpers";

export interface ColumnTotals {
  total: number;
  totalValue: number;
  totalProfit: number;
}

export interface OpenTotals {
  count: number;
  value: number;
  profit: number;
}

/** Sums the server-computed totals of the open columns only (Enquiry, Quoted,
 *  In Play) — Booked, Future and Lost never count towards the page subline. */
export function sumOpenTotals(columns: Partial<Record<PipelineStage, ColumnTotals | undefined>>): OpenTotals {
  const out: OpenTotals = { count: 0, value: 0, profit: 0 };
  for (const [stage, col] of Object.entries(columns) as Array<[PipelineStage, ColumnTotals | undefined]>) {
    if (!col || !isOpenStage(stage)) continue;
    out.count += col.total || 0;
    out.value += col.totalValue || 0;
    out.profit += col.totalProfit || 0;
  }
  return out;
}

/** Profit as a whole-number percentage of cost; null when there is no cost. */
export function marginPercent(profit: number, cost: number): number | null {
  if (!(cost > 0)) return null;
  return Math.round((profit / cost) * 100);
}
