import { useCallback, useMemo } from "react";
import { useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
import type { Transaction } from "@/features/quote/types";
import { transactionKeys, type DealPriority } from "@/features/transaction";
import {
  getTransactionProfit,
  getTransactionValue,
  type PipelinePage,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";

type Snapshot = InfiniteData<PipelinePage> | undefined;

/** Optimistic edits of the per-column infinite-query caches. Every helper
 *  targets the key produced by `keyForStage`, so patches land on exactly the
 *  query the board is rendering (same sort + filters). */
export function usePipelineCache(keyForStage: (stage: PipelineStage) => QueryKey) {
  const queryClient = useQueryClient();

  const snapshot = useCallback((stage: PipelineStage): Snapshot => queryClient.getQueryData<InfiniteData<PipelinePage>>(keyForStage(stage)), [keyForStage, queryClient]);

  const restore = useCallback(
    (stage: PipelineStage, prev: Snapshot) => {
      queryClient.setQueryData(keyForStage(stage), prev);
    },
    [keyForStage, queryClient],
  );

  /** Drops a card from a column right away, keeping the column totals in step.
   *  Returns the previous cache so a failed mutation can roll back. */
  const removeFromColumn = useCallback(
    (stage: PipelineStage, tx: Transaction): Snapshot => {
      const prev = snapshot(stage);
      const value = getTransactionValue(tx);
      const profit = getTransactionProfit(tx);
      queryClient.setQueryData<InfiniteData<PipelinePage>>(keyForStage(stage), (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.filter((t) => t.id !== tx.id),
            total: Math.max(0, (p.total ?? 0) - 1),
            totalValue: Math.max(0, (p.totalValue ?? 0) - value),
            totalProfit: Math.max(0, (p.totalProfit ?? 0) - profit),
          })),
        };
      });
      return prev;
    },
    [keyForStage, queryClient, snapshot],
  );

  /** Puts a card at the top of a column (used for Quoted <-> In Play moves). */
  const prependToColumn = useCallback(
    (stage: PipelineStage, tx: Transaction) => {
      const value = getTransactionValue(tx);
      const profit = getTransactionProfit(tx);
      queryClient.setQueryData<InfiniteData<PipelinePage>>(keyForStage(stage), (old) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((p, i) => ({
            ...p,
            items: i === 0 ? [tx, ...p.items.filter((t) => t.id !== tx.id)] : p.items,
            total: (p.total ?? 0) + 1,
            totalValue: (p.totalValue ?? 0) + value,
            totalProfit: (p.totalProfit ?? 0) + profit,
          })),
        };
      });
    },
    [keyForStage, queryClient],
  );

  const patchPriority = useCallback(
    (stage: PipelineStage, txId: string, priority: DealPriority): Snapshot => {
      const prev = snapshot(stage);
      queryClient.setQueryData<InfiniteData<PipelinePage>>(keyForStage(stage), (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            items: p.items.map((t) => (t.id === txId ? { ...t, priority } : t)),
          })),
        };
      });
      return prev;
    },
    [keyForStage, queryClient, snapshot],
  );

  const invalidateStage = useCallback(
    (stage: PipelineStage) => {
      void queryClient.invalidateQueries({ queryKey: keyForStage(stage) });
    },
    [keyForStage, queryClient],
  );

  const invalidateCounts = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...transactionKeys.all, "pipeline-counts"] });
  }, [queryClient]);

  return useMemo(
    () => ({ snapshot, restore, removeFromColumn, prependToColumn, patchPriority, invalidateStage, invalidateCounts }),
    [snapshot, restore, removeFromColumn, prependToColumn, patchPriority, invalidateStage, invalidateCounts],
  );
}

export type PipelineCache = ReturnType<typeof usePipelineCache>;
