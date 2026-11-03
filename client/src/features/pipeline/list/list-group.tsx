import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { formatCurrency, STAGE_LABEL, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import type { Transaction } from "@/features/quote/types";
import type { ColumnData } from "@/features/pipeline/state/use-pipeline-columns";
import { StagePill } from "@/features/pipeline/shared/stage-pill";
import { ListRow } from "./list-row";
import { LIST_GROUP_PREVIEW } from "./list-columns";

/** One stage's collapsible group: header with totals, up to 5 rows, then "Show n more". */
export function ListGroup({
  stage,
  column,
  defaultOpen,
  selectedId,
  getClientName,
  onOpen,
  onAddTask,
}: {
  stage: PipelineStage;
  column: ColumnData;
  defaultOpen: boolean;
  selectedId: string | null;
  getClientName: (id: string | null) => string;
  onOpen: (t: Transaction, stage: PipelineStage) => void;
  onAddTask: (t: Transaction, stage: PipelineStage) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [all, setAll] = useState(false);
  const rows = all ? column.items : column.items.slice(0, LIST_GROUP_PREVIEW);
  const hidden = Math.max(0, column.total - rows.length);

  return (
    <div data-testid={`list-group-${stage.toLowerCase().replace(" ", "-")}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-10 w-full items-center gap-2.5 border-b border-pipeline-card-border bg-muted/60 px-[18px] text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-social-muted" strokeWidth={2} /> : <ChevronRight className="h-4 w-4 text-social-muted" strokeWidth={2} />}
        <StagePill stage={stage} />
        <span className="text-[12px] text-social-muted">{column.total} {column.total === 1 ? "deal" : "deals"}</span>
        <span className="flex-1" />
        {stage !== "Lost" && (
          <span className="text-[12.5px] text-social-muted">
            <b className="font-semibold text-foreground">{formatCurrency(column.totalValue)}</b> value ·{" "}
            <b className="font-semibold text-pipeline-profit">{formatCurrency(column.totalProfit)}</b> profit
          </span>
        )}
      </button>
      {open &&
        rows.map((tx) => (
          <ListRow
            key={tx.id}
            transaction={tx}
            stage={stage}
            clientName={getClientName(tx.client_id)}
            selected={tx.id === selectedId}
            onOpen={() => onOpen(tx, stage)}
            onAddTask={() => onAddTask(tx, stage)}
          />
        ))}
      {open && column.items.length > LIST_GROUP_PREVIEW && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          className="flex h-[42px] w-full items-center gap-2 border-b border-pipeline-card-border bg-card px-[18px] text-[13px] font-semibold text-social-orange-text"
        >
          {all ? <ChevronUp className="h-[15px] w-[15px]" strokeWidth={2.2} /> : <ChevronDown className="h-[15px] w-[15px]" strokeWidth={2.2} />}
          {all ? `Show fewer ${STAGE_LABEL[stage].toLowerCase()}` : `Show ${hidden} more ${STAGE_LABEL[stage].toLowerCase()}`}
        </button>
      )}
      {open && all && column.hasNextPage && (
        <button
          type="button"
          onClick={column.fetchNextPage}
          disabled={column.isFetchingNextPage}
          className="flex h-[42px] w-full items-center gap-2 border-b border-pipeline-card-border bg-card px-[18px] text-[13px] font-semibold text-social-muted"
          data-testid={`button-load-more-${stage.toLowerCase()}`}
        >
          {column.isFetchingNextPage ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}
