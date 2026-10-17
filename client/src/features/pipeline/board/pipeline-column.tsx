import { useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/features/quote/types";
import { DealCard, type CardActions } from "@/features/pipeline/card/deal-card";
import { STAGE_LABEL, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { COLUMN_PREVIEW_LIMIT, visibleColumnItems } from "@/features/pipeline/lib/column-visibility";
import type { ColumnData } from "@/features/pipeline/state/use-pipeline-columns";
import { ColumnHeader } from "./column-header";
import { CollapsedRail } from "./collapsed-rail";

const EMPTY_TEXT: Partial<Record<PipelineStage, string>> = {
  Booked: "Bookings you win will appear here",
  Future: "Park deals for later and they appear here.",
};

interface PipelineColumnProps extends CardActions {
  stage: PipelineStage;
  column: ColumnData;
  collapsed: boolean;
  onToggleCollapse: () => void;
  isDragActive: boolean;
  dragFromStage: PipelineStage | null;
  isValidDrop: (from: PipelineStage, to: PipelineStage) => boolean;
  selectedId: string | null;
  getClientName: (id: string | null) => string;
  onDragStart: (t: Transaction, stage: PipelineStage) => void;
  onDrop: (id: string, from: PipelineStage, to: PipelineStage) => void;
}

export function PipelineColumn({
  stage,
  column,
  collapsed,
  onToggleCollapse,
  isDragActive,
  dragFromStage,
  isValidDrop,
  selectedId,
  getClientName,
  onDragStart,
  onDrop,
  ...actions
}: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isTarget = isDragActive && !!dragFromStage && isValidDrop(dragFromStage, stage);
  const { visible, hiddenCount } = visibleColumnItems(column.items, column.total, expanded);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = column;

  // Expanded columns keep loading pages as the sentinel at the bottom scrolls into view.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!expanded || !hasNextPage || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) fetchNextPage();
      },
      { root: scrollerRef.current, rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const expand = () => {
    setExpanded(true);
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  };

  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!isTarget) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsOver(true);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (e.currentTarget.contains(e.relatedTarget as Node)) return;
      setIsOver(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsOver(false);
      try {
        const d = JSON.parse(e.dataTransfer.getData("application/json"));
        if (d.transactionId && d.fromStage !== stage) onDrop(d.transactionId, d.fromStage, stage);
      } catch {
        // ignore malformed drag payloads
      }
    },
  };

  if (collapsed) {
    return <CollapsedRail stage={stage} count={column.total} isOver={isOver} onExpand={onToggleCollapse} dropHandlers={dropHandlers} />;
  }

  const dropHere = isTarget && (isOver || stage === "Booked");

  return (
    <section
      className={cn(
        "relative flex min-h-0 min-w-[250px] flex-1 flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-pipeline-column-bg",
        dropHere && "border-dashed border-social-orange bg-pipeline-drop-bg",
      )}
      aria-label={STAGE_LABEL[stage]}
      data-testid={`pipeline-column-${stage.toLowerCase().replace(" ", "-")}`}
      {...dropHandlers}
    >
      <ColumnHeader stage={stage} total={column.total} totalValue={column.totalValue} totalProfit={column.totalProfit} onCollapse={onToggleCollapse} />

      <div ref={scrollerRef} className={cn("relative flex min-h-0 flex-1 flex-col gap-2.5 px-3 pb-3", expanded ? "no-scrollbar overflow-y-auto" : "overflow-hidden")}>
        {isDragActive && stage === "Booked" && dragFromStage !== "Booked" && isTarget && (
          <div className="grid h-[150px] flex-none place-items-center rounded-[14px] border-2 border-dashed border-social-orange bg-social-orange/10 text-center text-[13px] font-semibold text-stage-inplay-fg">
            <div className="grid justify-items-center gap-1.5">
              <Plus className="h-[22px] w-[22px]" strokeWidth={2.4} />
              Drop here to move to Booked
            </div>
          </div>
        )}

        {column.isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : column.items.length === 0 ? (
          <p className="px-1.5 py-[18px] text-center text-[13px] text-social-muted">{isTarget ? "Drop here" : EMPTY_TEXT[stage] ?? "No deals here"}</p>
        ) : (
          visible.map((tx) => (
            <DealCard
              key={tx.id}
              transaction={tx}
              stage={stage}
              clientName={getClientName(tx.client_id)}
              selected={tx.id === selectedId}
              draggable={!column.isPlaceholderData}
              onDragStart={onDragStart}
              {...actions}
            />
          ))
        )}

        {expanded && column.isFetchingNextPage && (
          <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        )}
        {expanded && hasNextPage && <div ref={sentinelRef} className="h-px flex-none" aria-hidden />}
        {expanded && column.hasNextPage && !column.isFetchingNextPage && (
          <Button type="button" variant="outline" size="sm" className="h-[34px] flex-none rounded-[10px] border-social-border bg-card text-[12.5px]" onClick={column.fetchNextPage} data-testid={`button-load-more-${stage.toLowerCase()}`}>
            Load more
          </Button>
        )}
        {expanded && column.items.length > COLUMN_PREVIEW_LIMIT && (
          <Button type="button" variant="outline" size="sm" className="h-[34px] flex-none rounded-[10px] border-social-border bg-card text-[12.5px]" onClick={() => setExpanded(false)} data-testid={`button-show-fewer-${stage.toLowerCase()}`}>
            Show fewer
          </Button>
        )}

        {!expanded && hiddenCount > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-pipeline-column-bg from-[52%] to-transparent px-3 pb-3 pt-12">
            <Button type="button" variant="outline" className="pointer-events-auto h-[38px] w-full rounded-[10px] border-social-border bg-card text-[13px] font-semibold" onClick={expand} data-testid={`button-show-more-${stage.toLowerCase()}`}>
              Show {hiddenCount} more {hiddenCount === 1 ? "deal" : "deals"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
