import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser, transactionKeys } from "@/hooks/queries";
import { useUpdateTransaction, useUpdateQuote } from "@/hooks/mutations";
import { buildQuoteInitialValuesFromEnquiry } from "@/features/quote/lib/enquiry-to-quote";
import { enquiryApi } from "@/api";
import { enquiryKeys } from "@/features/enquiry/api/use-enquiry-queries";
import type { Transaction } from "@/features/quote/types";
import { STAGE_TO_STATUS, getStageForTransaction, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import type { PipelineCache } from "./use-pipeline-cache";
import type { PipelineDialogs } from "./use-pipeline-dialogs";
import type { PipelineParking } from "./use-pipeline-parking";

/** Every stage transition the board supports (drag-and-drop and the drawer's
 *  "Move to…"). The rules are unchanged from the original board. */
export function usePipelineMoves(cache: PipelineCache, parking: PipelineParking, dialogs: PipelineDialogs) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { mutate: mutateTransaction } = useUpdateTransaction();
  const { mutate: mutateQuote } = useUpdateQuote();
  const { setQuoteDialog, setBookingQuoteId, setFutureDialog, setLostConfirm } = dialogs;

  // Handles every move that isn't Future/Lost — i.e. the original board's
  // stage transitions (enquiry -> quote dialog, quote/in-play -> booking
  // dialog, quoted <-> in-play, and the generic status fallback).
  const applyStageTransition = useCallback(
    (tx: Transaction, from: PipelineStage, to: PipelineStage) => {
      if (from === "Enquiry" && to === "Quoted") {
        const baseDialog = { transactionId: tx.id, clientId: tx.client_id || "", userId: tx.user_id || currentUser?.id || "" };
        if (tx.enquiry?.id) {
          const enquiryId = tx.enquiry.id;
          void (async () => {
            try {
              const enq = await queryClient.fetchQuery({
                queryKey: enquiryKeys.detail(enquiryId),
                queryFn: () => enquiryApi.getById(enquiryId),
              });
              setQuoteDialog({ ...baseDialog, initialValues: buildQuoteInitialValuesFromEnquiry(enq), enquiryId });
            } catch {
              toast({ title: "Failed to load enquiry details", variant: "destructive" });
            }
          })();
        } else {
          setQuoteDialog(baseDialog);
        }
        return;
      }

      if ((from === "Quoted" || from === "In Play") && to === "Booked") {
        const aq = tx.quotes?.find((q) => !q.isFreeQuote && !q.isQuoteCopy) ?? tx.quotes?.find((q) => !q.isFreeQuote);
        if (!aq) {
          toast({ title: "No quote found", variant: "destructive" });
          return;
        }
        setBookingQuoteId(aq.id);
        return;
      }

      if ((to === "In Play" || to === "Quoted") && (from === "Quoted" || from === "In Play")) {
        const primaryQuote =
          tx.quote_variants?.find((v) => v.isQuoteCopy === false) ??
          tx.quote_variants?.[0] ??
          tx.quotes?.find((q) => !q.isQuoteCopy) ??
          tx.quotes?.[0];
        if (!primaryQuote) {
          toast({ title: "No quote found", variant: "destructive" });
          return;
        }
        const newQuoteStatus = to === "In Play" ? "in_play" : "quoted";
        const prevSource = cache.snapshot(from);
        const prevTarget = cache.snapshot(to);

        const movedTx: Transaction = {
          ...tx,
          quote_variants: (tx.quote_variants ?? []).map((v) => (v.isQuoteCopy === false ? { ...v, quote_status: newQuoteStatus } : v)),
          quotes: (tx.quotes ?? []).map((q) => (!q.isQuoteCopy ? { ...q, quote_status: newQuoteStatus } : q)),
        };
        cache.removeFromColumn(from, tx);
        cache.prependToColumn(to, movedTx);

        mutateQuote(
          { id: primaryQuote.id, data: { quote_status: newQuoteStatus } },
          {
            onError: () => {
              cache.restore(from, prevSource);
              cache.restore(to, prevTarget);
              toast({ title: "Error moving transaction", variant: "destructive" });
            },
            onSettled: () => {
              cache.invalidateStage(from);
              cache.invalidateStage(to);
            },
          },
        );
        return;
      }

      const status = STAGE_TO_STATUS[to];
      if (!status) return;
      mutateTransaction(
        { id: tx.id, data: { status } },
        {
          onSuccess: () => {
            toast({ title: `Moved to ${to}` });
            void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          },
          onError: () => {
            toast({ title: "Error moving transaction", variant: "destructive" });
          },
        },
      );
    },
    [cache, currentUser, queryClient, setBookingQuoteId, setQuoteDialog, toast, mutateQuote, mutateTransaction],
  );

  /** Moves a deal between any two columns, honouring the transition rules. */
  const moveDealTo = useCallback(
    (tx: Transaction, from: PipelineStage, to: PipelineStage) => {
      if (from === to) return;

      if (to === "Lost" && from === "Booked") {
        toast({ title: "Bookings can't be marked as lost", variant: "destructive" });
        return;
      }

      // A lost deal can't move directly onto Booked (or any stage besides
      // Enquiry/Quoted/In Play/Future) — the server has no transition for
      // that. Restore it first, then chain into the requested column.
      if (from === "Lost") {
        if (to === "Future") {
          const prev = cache.removeFromColumn("Lost", tx);
          parking.mutateLost(
            { id: tx.id, lost: false },
            {
              onSuccess: () => setFutureDialog({ tx, fromStage: getStageForTransaction(tx) }),
              onError: () => {
                cache.restore("Lost", prev);
                toast({ title: "Failed to restore deal", variant: "destructive" });
              },
            },
          );
          return;
        }

        if (to === "Enquiry" || to === "Quoted") {
          parking.handleSetLost(tx, from, false);
          return;
        }

        if (to === "In Play") {
          const prev = cache.removeFromColumn("Lost", tx);
          parking.mutateLost(
            { id: tx.id, lost: false },
            {
              onSuccess: () => {
                const naturalStage = getStageForTransaction(tx);
                if (naturalStage === "In Play") {
                  toast({ title: "Deal restored" });
                  return;
                }
                applyStageTransition(tx, naturalStage, "In Play");
              },
              onError: () => {
                cache.restore("Lost", prev);
                toast({ title: "Failed to restore deal", variant: "destructive" });
              },
            },
          );
          return;
        }

        toast({ title: "Restore the deal first", variant: "destructive" });
        return;
      }

      if (to === "Future") {
        setFutureDialog({ tx, fromStage: from });
        return;
      }

      if (to === "Lost") {
        setLostConfirm({ tx, stage: from });
        return;
      }

      if (from === "Future") {
        const naturalStage = getStageForTransaction(tx);
        cache.removeFromColumn("Future", tx);
        parking.mutateFuture(
          { id: tx.id, futureDealDate: null },
          {
            onSuccess: () => {
              toast({ title: "Returned to pipeline" });
              if (to !== naturalStage) applyStageTransition(tx, naturalStage, to);
            },
            onError: () => {
              toast({ title: "Failed to return to pipeline", variant: "destructive" });
              void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
            },
          },
        );
        return;
      }

      applyStageTransition(tx, from, to);
    },
    [applyStageTransition, cache, parking, queryClient, setFutureDialog, setLostConfirm, toast],
  );

  return useMemo(() => ({ applyStageTransition, moveDealTo }), [applyStageTransition, moveDealTo]);
}

export type PipelineMoves = ReturnType<typeof usePipelineMoves>;
