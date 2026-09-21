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
