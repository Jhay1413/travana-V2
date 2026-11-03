import type { Transaction } from "@/features/quote/types";
import { getStageForTransaction, type PipelineStage } from "./pipeline-helpers";

export interface TaskEntity {
  type: "enquiry" | "quote";
  id?: string;
  userId?: string;
}

/**
 * The record a deal's tasks attach to. Booking tasks are stored under entityType
 * "quote" with the booking's id (see holiday-detail-view.tsx), so a Booked deal
 * must match that. `id` is undefined when the deal has no such record yet.
 */
export function getTaskEntity(t: Transaction, stage: PipelineStage): TaskEntity {
  const naturalStage = stage === "Future" ? getStageForTransaction(t) : stage;
  const mainQuote = t.quotes?.find((q) => !q.isQuoteCopy) || t.quotes?.[0];
  if (naturalStage === "Enquiry") return { type: "enquiry", id: t.enquiry?.id, userId: t.enquiry?.user_id };
  if (naturalStage === "Booked") {
    return { type: "quote", id: t.booking?.id, userId: (t.booking as unknown as { user_id?: string } | undefined)?.user_id };
  }
  return { type: "quote", id: mainQuote?.id, userId: (mainQuote as unknown as { user_id?: string } | undefined)?.user_id };
}
