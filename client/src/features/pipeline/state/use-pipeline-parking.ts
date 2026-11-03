import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { transactionKeys } from "@/hooks/queries";
import { useSetDealLost, useSetFutureDeal, useUpdateDealPriority } from "@/hooks/mutations";
import type { Transaction } from "@/features/quote/types";
import type { DealPriority } from "@/features/transaction";
import type { PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import type { PipelineCache } from "./use-pipeline-cache";

/** Priority edits and the Lost / Future "parking" actions. Each one patches the
 *  column cache first and rolls back (or refetches) when the server refuses. */
export function usePipelineParking(cache: PipelineCache, onFutureSettled: () => void, priorityFilterActive: boolean) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutate: mutatePriority } = useUpdateDealPriority();
  const { mutate: mutateFuture, isPending: isFuturePending } = useSetFutureDeal();
  const { mutate: mutateLost } = useSetDealLost();

  const handleSetPriority = useCallback(
    (tx: Transaction, priority: DealPriority, stage: PipelineStage) => {
      const prev = cache.patchPriority(stage, tx.id, priority);
      // Note: the mutation invalidates nothing on success — this optimistic
      // patch is the only cache update, so a stray invalidation wouldn't reset
      // every column's paging. On error, roll back and refetch the real state.
      mutatePriority(
        { id: tx.id, priority },
        {
          onSuccess: () => {
            // With a priority filter on, the deal may no longer belong in this column.
            if (!priorityFilterActive) return;
            cache.invalidateStage(stage);
            cache.invalidateCounts();
          },
          onError: () => {
            cache.restore(stage, prev);
            cache.invalidateStage(stage);
            toast({ title: "Failed to update priority", variant: "destructive" });
          },
        },
      );
    },
    [cache, priorityFilterActive, toast, mutatePriority],
  );

  const handleSetLost = useCallback(
    (tx: Transaction, fromStage: PipelineStage, lost: boolean) => {
      const prev = cache.removeFromColumn(fromStage, tx);
      mutateLost(
        { id: tx.id, lost },
        {
          onSuccess: () => toast({ title: lost ? "Deal marked as lost" : "Deal restored" }),
          onError: () => {
            cache.restore(fromStage, prev);
            toast({ title: lost ? "Failed to mark as lost" : "Failed to restore", variant: "destructive" });
          },
        },
      );
    },
    [cache, mutateLost, toast],
  );

  const confirmFuture = useCallback(
    (tx: Transaction, fromStage: PipelineStage, date: string) => {
      cache.removeFromColumn(fromStage, tx);
      mutateFuture(
        { id: tx.id, futureDealDate: date },
        {
          onSuccess: () => toast({ title: "Moved to Future" }),
          onError: () => {
            toast({ title: "Failed to move to Future", variant: "destructive" });
            cache.invalidateStage(fromStage);
          },
          onSettled: onFutureSettled,
        },
      );
    },
    [cache, onFutureSettled, mutateFuture, toast],
  );

  const handleReturnToPipeline = useCallback(
    (tx: Transaction) => {
      cache.removeFromColumn("Future", tx);
      mutateFuture(
        { id: tx.id, futureDealDate: null },
        {
          onSuccess: () => toast({ title: "Returned to pipeline" }),
          onError: () => {
            toast({ title: "Failed to return to pipeline", variant: "destructive" });
            void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          },
        },
      );
    },
    [cache, mutateFuture, queryClient, toast],
  );

  return useMemo(
    () => ({
      handleSetPriority,
      handleSetLost,
      confirmFuture,
      handleReturnToPipeline,
      isFuturePending,
      mutateLost,
      mutateFuture,
    }),
    [handleSetPriority, handleSetLost, confirmFuture, handleReturnToPipeline, isFuturePending, mutateLost, mutateFuture],
  );
}

export type PipelineParking = ReturnType<typeof usePipelineParking>;
