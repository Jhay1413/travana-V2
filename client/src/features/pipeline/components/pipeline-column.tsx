import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { HEADER_ICON_BUTTON_CLASS } from "@/features/client/components/holiday-detail-view";
import type { Transaction } from "@/features/quote/types";
import {
  formatCurrency,
  getTransactionProfit,
  getTransactionValue,
  STAGE_LABEL,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";
import { DealCard } from "@/features/pipeline/components/deal-card";

type Priority = "low" | "medium" | "high";

interface PipelineColumnProps {
  stage: PipelineStage;
  index: number;
  transactions: Transaction[];
  total: number;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isDragActive: boolean;
  dragFromStage: PipelineStage | null;
  isValidDrop: (from: PipelineStage, to: PipelineStage) => boolean;
  getClientName: (id: string | null) => string;
  onDragStart: (t: Transaction, stage: PipelineStage) => void;
  onDrop: (id: string, from: PipelineStage, to: PipelineStage) => void;
  onCardClick: (t: Transaction, stage: PipelineStage) => void;
  onSetPriority: (t: Transaction, priority: Priority) => void;
  onMoveToFuture: (t: Transaction) => void;
  onReturnToPipeline: (t: Transaction) => void;
  onMarkLost: (t: Transaction) => void;
  onRestore: (t: Transaction) => void;
}

export function PipelineColumn({
  stage,
  index,
  transactions,
  total,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  collapsed,
  onToggleCollapse,
  isDragActive,
  dragFromStage,
  isValidDrop,
  getClientName,
  onDragStart,
  onDrop,
  onCardClick,
  onSetPriority,
  onMoveToFuture,
  onReturnToPipeline,
  onMarkLost,
  onRestore,
}: PipelineColumnProps) {
  const stripeBg = index % 2 === 1 ? "bg-gray-50" : "bg-white";
  const [isOver, setIsOver] = useState(false);
  const isTarget = isDragActive && !!dragFromStage && isValidDrop(dragFromStage, stage);

  const cardTotalValue = useMemo(() => transactions.reduce((s, tx) => s + getTransactionValue(tx), 0), [transactions]);
  const cardTotalProfit = useMemo(() => transactions.reduce((s, tx) => s + getTransactionProfit(tx), 0), [transactions]);

  const handleDragOver = (e: React.DragEvent) => {
    if (!isTarget) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    try {
      const d = JSON.parse(e.dataTransfer.getData("application/json"));
      if (d.transactionId && d.fromStage !== stage) onDrop(d.transactionId, d.fromStage, stage);
    } catch {
      // ignore malformed drag payloads
    }
  };

  if (collapsed) {
    return (
      <div
        className={cn(
          "flex w-14 shrink-0 flex-col items-center gap-3 3xl:w-16 border-r border-black/10 py-3 last:rounded-r-lg last:border-r-0",
          stripeBg,
          isOver && "bg-blue-50/60",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid={`pipeline-column-${stage.toLowerCase().replace(" ", "-")}-collapsed`}
      >
        <button type="button" className={HEADER_ICON_BUTTON_CLASS} onClick={onToggleCollapse} data-testid={`button-expand-${stage.toLowerCase()}`}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-2 whitespace-nowrap text-sm font-semibold text-black/80 3xl:text-base" style={{ writingMode: "vertical-rl" }}>
          {STAGE_LABEL[stage]}&nbsp;&nbsp;{total}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex min-w-[240px] flex-1 flex-col overflow-hidden 3xl:min-w-[280px] border-r border-black/10 first:rounded-l-lg last:rounded-r-lg last:border-r-0", stripeBg)}
      data-testid={`pipeline-column-${stage.toLowerCase().replace(" ", "-")}`}
    >
      <div className="flex h-[76px] shrink-0 flex-col 3xl:h-[100px] justify-center gap-1.5 border-b border-black/10 bg-gray-100 px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 truncate">
            <span className="text-sm font-semibold 3xl:text-base">{STAGE_LABEL[stage]}</span>
            <span className="ml-1 text-xs text-black/40 3xl:text-sm">({total})</span>
          </div>
          <button type="button" className={HEADER_ICON_BUTTON_CLASS} onClick={onToggleCollapse} data-testid={`button-collapse-${stage.toLowerCase()}`}>
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="text-xs text-black/60 3xl:text-sm">
          {formatCurrency(cardTotalValue)} / {formatCurrency(cardTotalProfit)}
        </div>
      </div>

      <div
        className={cn("no-scrollbar flex-1 space-y-2 overflow-y-auto p-2.5 3xl:space-y-2.5 3xl:p-3 transition-colors", isOver && "bg-blue-50/60")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isOver && (
          <div className="rounded-lg border-2 border-dashed border-blue-300 p-3 text-center">
            <p className="text-xs font-medium text-blue-500">Drop here to move to {STAGE_LABEL[stage]}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : transactions.length === 0 && !isOver ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-xs text-gray-400">{isTarget ? "Drop here" : "No deals"}</p>
          </div>
        ) : (
          <>
            {transactions.map((tx) => (
              <DealCard
                key={tx.id}
                transaction={tx}
                stage={stage}
                clientName={getClientName(tx.client_id)}
                onDragStart={onDragStart}
                onCardClick={onCardClick}
                onSetPriority={onSetPriority}
                onMoveToFuture={onMoveToFuture}
                onReturnToPipeline={onReturnToPipeline}
                onMarkLost={onMarkLost}
                onRestore={onRestore}
              />
            ))}
            {isFetchingNextPage && (
              <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-300" /></div>
            )}
            {hasNextPage && !isFetchingNextPage && (
              <button
                type="button"
                onClick={fetchNextPage}
                className="w-full rounded-lg border border-dashed border-gray-200 py-2 text-[12px] text-gray-400 transition-all hover:border-gray-300 hover:bg-gray-50 hover:text-gray-600"
                data-testid={`button-load-more-${stage.toLowerCase()}`}
              >
                Load more
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
