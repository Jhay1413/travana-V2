import type { DealPriority } from "@shared/schema";

export type { DealPriority };

/** Earliest-due, incomplete task across a pipeline card's linked entities
 *  (enquiry / primary quotes / booking) — see enrichTransactionsLightweight. */
export interface NextTask {
  id: string;
  title: string | null;
  due_date: string | null;
  user_id: string | null;
}
