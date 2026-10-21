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
}

export interface DealRef {
  tx: Transaction;
  stage: PipelineStage;
  /** Open the drawer with the Add task pop-up already showing. */
  addTask?: boolean;
}

/** Open/closed state of every dialog and the drawer on the pipeline page. */
export function usePipelineDialogs() {
  const [quoteDialog, setQuoteDialog] = useState<QuoteDialogState | null>(null);
  const [bookingQuoteId, setBookingQuoteId] = useState<string | null>(null);
  const [futureDialog, setFutureDialog] = useState<{ tx: Transaction; fromStage: PipelineStage } | null>(null);
  const [lostConfirm, setLostConfirm] = useState<DealRef | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealRef | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);

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
    newDealOpen,
    setNewDealOpen,
  };
}

export type PipelineDialogs = ReturnType<typeof usePipelineDialogs>;
