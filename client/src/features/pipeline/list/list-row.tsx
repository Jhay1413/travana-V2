import { CalendarDays, Phone, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { InitialsAvatar } from "@/features/agent-overview/components/dashboard-ui";
import type { Transaction } from "@/features/quote/types";
import {
  formatCurrency,
  formatDueDateTime,
  getAssigneeName,
  getClientPhone,
  getTourOperator,
  getTransactionProfit,
  getTransactionTitle,
  getTransactionValue,
  hasQuoteOrBooking,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";
import { buildDealMeta, isDueToday } from "@/features/pipeline/lib/deal-meta";
import { quietDays } from "@/features/pipeline/lib/quiet";
import { OperatorTile } from "@/features/pipeline/shared/operator-tile";
import { PriorityDot } from "@/features/pipeline/shared/priority-dot";
import { QuietLabel } from "@/features/pipeline/card/deal-card-footer";
import { LIST_GRID_COLS } from "./list-columns";

function NextTaskCell({ tx, stage, onAddTask }: { tx: Transaction; stage: PipelineStage; onAddTask: () => void }) {
  if (stage === "Booked") {
    return (
      <div className="min-w-0 text-[12.5px]">
        <div className="flex items-center gap-1.5"><span className="text-social-muted">Booking</span><b className="truncate font-semibold">{tx.booking?.hays_ref || "—"}</b></div>
        <div className="flex items-center gap-1.5"><span className="text-social-muted">Tour</span><b className="truncate font-semibold">{tx.booking?.supplier_ref || "—"}</b></div>
      </div>
    );
  }
  if (stage === "Lost") return <span className="text-[12px] text-[#8A94A6]">—</span>;
  if (tx.next_task) {
    const today = isDueToday(tx.next_task.due_date);
    return (
      <div className="flex min-w-0 items-center gap-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-stage-quoted-dot" strokeWidth={2} />
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold">{tx.next_task.title || "Untitled task"}</div>
          <div className={cn("whitespace-nowrap text-[12px]", today ? "font-semibold text-social-orange-text" : "text-social-muted")}>
            {formatDueDateTime(tx.next_task.due_date)}
          </div>
        </div>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onAddTask(); }}
      className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border-[1.5px] border-dashed border-pipeline-notask-border bg-pipeline-notask-bg px-2.5 py-[3px] text-[12px] font-medium text-stage-inplay-fg"
    >
      <TriangleAlert className="h-[13px] w-[13px]" strokeWidth={2} />
      No task scheduled
    </button>
  );
}

export function ListRow({
  transaction: tx,
  stage,
  clientName,
  selected,
  onOpen,
  onAddTask,
}: {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  selected: boolean;
  onOpen: () => void;
  onAddTask: () => void;
}) {
  const operator = getTourOperator(tx);
  const hasMoney = hasQuoteOrBooking(tx);
  const phone = getClientPhone(tx);
  const none = <div className="text-right text-[14px] font-medium text-[#8A94A6]">None</div>;
  const active = (quietDays(tx.last_activity_at) ?? 0) < 1;

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={cn(
        "grid h-[52px] cursor-pointer items-center gap-3.5 border-b border-pipeline-card-border bg-card px-[18px] hover:bg-muted/50",
        selected && "bg-pipeline-notask-bg",
      )}
      style={{ gridTemplateColumns: LIST_GRID_COLS }}
      data-testid={`list-row-${tx.id}`}
    >
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold">{getTransactionTitle(tx)}</div>
        <div className="truncate text-[12px] text-social-muted">{buildDealMeta(tx, stage)}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-medium">{clientName}</div>
        {phone && (
          <div className="flex items-center gap-[5px] text-[12px] text-social-muted"><Phone className="h-3 w-3" strokeWidth={2} />{phone}</div>
        )}
      </div>
      {operator.name || operator.logoUrl ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <OperatorTile name={operator.name} logoUrl={operator.logoUrl} size={30} />
          <span className="truncate text-[13px]">{operator.name}</span>
        </div>
      ) : (
        <span className="text-[12.5px] text-[#8A94A6]">Not chosen yet</span>
      )}
      {hasMoney ? <div className="text-right text-[14px] font-semibold tabular-nums">{formatCurrency(getTransactionValue(tx))}</div> : none}
      {hasMoney ? <div className="text-right text-[14px] font-semibold tabular-nums text-pipeline-profit">{formatCurrency(getTransactionProfit(tx))}</div> : none}
      <InitialsAvatar name={getAssigneeName(tx)} solid className="h-[26px] w-[26px] text-[10px]" />
      <PriorityDot priority={tx.priority || "low"} />
      <NextTaskCell tx={tx} stage={stage} onAddTask={onAddTask} />
      <div>{active ? <span className="text-[12px] text-social-muted">Active today</span> : <QuietLabel lastActivityAt={tx.last_activity_at} />}</div>
    </div>
  );
}
