import { useState } from "react";
import type { Transaction } from "@/features/quote/types";
import type { QuoteFormValues } from "@/features/quote/types/quote-form.types";
import type { PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";

export interface QuoteDialogState {
  transactionId: string;
  clientId: string;
  userId: string;
  initialValues?: Partial<QuoteFormValues>;
  enquiryId?: string;
  /** Column the card was dropped on; after a successful save the deal lands here. */
  targetStage?: "Quoted" | "In Play";
}

export interface DealRef {
  tx: Transaction;
  stage: PipelineStage;
}

/** Open/closed state of every dialog and the drawer on the pipeline page. */
export function usePipelineDialogs() {
  const [quoteDialog, setQuoteDialog] = useState<QuoteDialogState | null>(null);
  const [bookingQuoteId, setBookingQuoteId] = useState<string | null>(null);
  const [futureDialog, setFutureDialog] = useState<{ tx: Transaction; fromStage: PipelineStage } | null>(null);
  const [lostConfirm, setLostConfirm] = useState<DealRef | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealRef | null>(null);

  return {
    quoteDialog,
    setQuoteDialog,
    bookingQuoteId,
    setBookingQuoteId,
    futureDialog,
    setFutureDialog,
    lostConfirm,
    setLostConfirm,
    selectedDeal,
    setSelectedDeal,
  };
}

export type PipelineDialogs = ReturnType<typeof usePipelineDialogs>;
