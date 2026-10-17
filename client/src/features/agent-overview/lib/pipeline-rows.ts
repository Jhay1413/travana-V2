import type { Transaction } from "@/features/quote/types";
import {
  getStageForTransaction,
  getTransactionProfit,
  getTransactionTitle,
  type PipelineStage,
} from "@/features/pipeline";

export interface PipelineListRow {
  id: string;
  customer: string;
  createdAt: string;
  title: string;
  /** Stage-aware profit, identical to the /pipeline cards. */
  profit: number;
  stage: PipelineStage;
}

export const PIPELINE_LIST_SIZE = 5;

export function toPipelineListRow(t: Transaction): PipelineListRow {
  const withName = t as Transaction & { client_name?: string | null };
  return {
    id: t.id,
    customer: withName.client_name || t.client?.name || "Unknown Client",
    createdAt: t.created_at,
    title: getTransactionTitle(t),
    profit: getTransactionProfit(t),
    stage: getStageForTransaction(t),
  };
}

/** Newest deals first across the merged columns, capped at the list size. */
export function recentPipelineRows(deals: Transaction[], size = PIPELINE_LIST_SIZE): PipelineListRow[] {
  return [...deals]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, size)
    .map(toPipelineListRow);
}
