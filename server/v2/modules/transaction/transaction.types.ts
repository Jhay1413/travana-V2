import type { DealPriority, Transaction } from "@shared/schema";

export type { DealPriority };

/** Earliest-due, incomplete task across a pipeline card's linked entities
 *  (enquiry / primary quotes / booking) — see enrichTransactionsLightweight. */
export interface NextTask {
  id: string;
  title: string | null;
  due_date: string | null;
  user_id: string | null;
}

/** Narrowed shape of a row returned by transaction.repository.ts's
 *  enrichTransactionsLightweight, covering only the fields the "oldest
 *  activity" pipeline sort needs (transaction.service.ts's
 *  listPipelineByOldestActivity + transaction.repository.ts's
 *  findPipelineCandidates) — not a full re-type of that function's output,
 *  which also carries enquiry/quotes/booking/client fields. */
export interface PipelineCandidateItem extends Transaction {
  last_activity_at: string;
  next_task: NextTask | null;
}

/** Sorts accepted by GET /transactions/pipeline/:status. */
export type PipelineSort =
  | "newest"
  | "oldest"
  | "oldest-activity"
  | "latest_activity"
  | "value_desc"
  | "profit_desc"
  | "name_asc"
  | "quiet_first";

/** Sorts applied in SQL ("oldest-activity" is handled in JS by the service). */
export type PipelineSqlSort = Exclude<PipelineSort, "oldest-activity">;

export type PipelineQuick = "due_today" | "no_task" | "quiet_7";

/** Optional narrowing filters for a pipeline column. All are ANDed onto the scope conditions. */
export interface PipelineFilters {
  search?: string;
  priorities?: DealPriority[];
  tourOperatorIds?: string[];
  quick?: PipelineQuick;
}

export interface PipelineQuickCounts {
  all: number;
  due_today: number;
  no_task: number;
  quiet_7: number;
}

/** Whole-column aggregates (no LIMIT) for a filtered pipeline column. */
export interface PipelineTotals {
  total: number;
  totalValue: number;
  totalProfit: number;
}
