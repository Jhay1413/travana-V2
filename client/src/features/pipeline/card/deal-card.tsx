import { useState } from "react";
import { useLocation } from "wouter";
import { Eye, Phone, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDealPin } from "@/hooks/use-deal-pin";
import { PinToggleButton } from "@/components/shared/pin-toggle-button";
import { isDealPinned, resolveDealTarget } from "@/features/transaction";
import type { Transaction } from "@/features/quote/types";
import {
  getClientPhone,
  getTourOperator,
  getTransactionNavUrl,
  getTransactionTitle,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";
import { buildDealMeta } from "@/features/pipeline/lib/deal-meta";
import { OperatorTile } from "@/features/pipeline/shared/operator-tile";
import { DealCardOverflowMenu } from "./deal-card-menu";
import { DealCardQuotes } from "./deal-card-quotes";
import { DealCardMoney } from "./deal-card-money";
import { DealCardTask } from "./deal-card-task";
import { DealCardRefs } from "./deal-card-refs";
import { DealCardFooter } from "./deal-card-footer";

type Priority = "low" | "medium" | "high";

export interface DealCardProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  selected?: boolean;
  /** Mobile has no drag-and-drop. */
  draggable?: boolean;
  onDragStart: (t: Transaction, stage: PipelineStage) => void;
  onCardClick: (t: Transaction, stage: PipelineStage) => void;
  onSetPriority: (t: Transaction, priority: Priority) => void;
  onMoveToFuture: (t: Transaction) => void;
  onReturnToPipeline: (t: Transaction) => void;
  onMarkLost: (t: Transaction) => void;
  onRestore: (t: Transaction) => void;
  onAddQuote: (t: Transaction) => void;
  onAddTask: (t: Transaction) => void;
}

/** The per-card callbacks a column or list hands down to every card. */
export type CardActions = Omit<DealCardProps, "transaction" | "stage" | "clientName" | "selected" | "draggable" | "onDragStart">;

export function DealCard({
  transaction: t,
  stage,
  clientName,
  selected,
  draggable = true,
  onDragStart,
  onCardClick,
  onSetPriority,
  onMoveToFuture,
  onReturnToPipeline,
  onMarkLost,
  onRestore,
  onAddQuote,
  onAddTask,
}: DealCardProps) {
  const [, setLocation] = useLocation();
  const { pinnedKeys, togglePin, isLoaded: pinsLoaded } = useDealPin();
  const pinTarget = resolveDealTarget(t);
  const pinned = isDealPinned(t, pinnedKeys, pinsLoaded, pinTarget);
  const [isDragging, setIsDragging] = useState(false);

  const { name: operatorName, logoUrl: operatorLogo } = getTourOperator(t);
  const showOperator = stage !== "Enquiry" && !!(operatorName || operatorLogo);
  const duplicateCount = (t.quote_variants || []).filter((q) => q.isQuoteCopy).length;
  const navUrl = getTransactionNavUrl(t, stage);
  const phone = getClientPhone(t);
  const isLost = stage === "Lost";

  return (
    <article
      className={cn(
        "group relative flex flex-none cursor-pointer flex-col gap-[9px] rounded-[14px] border border-pipeline-card-border bg-card p-[14px] shadow-[0_1px_2px_rgba(30,41,59,.06)]",
        draggable && "active:cursor-grabbing",
        pinned && "border-amber-300/70",
        selected && "ring-2 ring-social-orange shadow-[0_6px_18px_rgba(30,41,59,.14)]",
        isDragging && "opacity-45",
      )}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ transactionId: t.id, fromStage: stage }));
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
        onDragStart(t, stage);
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={(e) => {
        if (isDragging || (e.target as HTMLElement).closest("button")) return;
        onCardClick(t, stage);
      }}
      data-testid={`pipeline-card-${t.id}`}
    >
      {/* Hover actions float over the top-right corner so the layout never shifts. */}
      <div className="absolute right-2 top-2 z-10 hidden items-center gap-0.5 rounded-md bg-card/95 p-0.5 shadow-sm group-hover:flex">
        {pinTarget && !pinned && (
          <PinToggleButton
            pinned={pinned}
            onToggle={() => togglePin(pinTarget.type, pinTarget.id, { label: pinTarget.title || getTransactionTitle(t), subtitle: clientName })}
            data-testid={`button-pin-deal-${t.id}`}
          />
        )}
        <button
          type="button"
          className="rounded-md p-1 hover:bg-muted"
          onClick={(e) => { e.stopPropagation(); setLocation(navUrl); }}
          data-testid={`button-view-deal-${t.id}`}
        >
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <DealCardOverflowMenu
          stage={stage}
          onOpen={() => setLocation(navUrl)}
          onSetPriority={(p) => onSetPriority(t, p)}
          onMoveToFuture={() => onMoveToFuture(t)}
          onReturnToPipeline={() => onReturnToPipeline(t)}
          onMarkLost={() => onMarkLost(t)}
          onRestore={() => onRestore(t)}
        />
      </div>

      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <h4
              className="line-clamp-2 min-w-0 text-[14.5px] font-semibold leading-[1.35]"
              data-testid={`pipeline-title-${t.id}`}
            >
              {getTransactionTitle(t)}
            </h4>
            {duplicateCount > 0 && (stage === "Quoted" || stage === "In Play") && <DealCardQuotes transaction={t} count={duplicateCount} />}
          </div>
          <div className="mt-0.5 truncate text-[12px] text-social-muted">{buildDealMeta(t, stage)}</div>
        </div>
        {pinTarget && pinned && (
          <PinToggleButton
            pinned={pinned}
            onToggle={() => togglePin(pinTarget.type, pinTarget.id, { label: pinTarget.title || getTransactionTitle(t), subtitle: clientName })}
            data-testid={`button-pin-deal-${t.id}`}
          />
        )}
        {showOperator && <OperatorTile name={operatorName} logoUrl={operatorLogo} />}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
          <User className="h-3.5 w-3.5 shrink-0 text-social-muted" strokeWidth={2} />
          <span className="truncate">{clientName}</span>
        </div>
        {phone && (
          <span className="inline-flex items-center gap-[5px] whitespace-nowrap text-[12px] text-social-muted">
            <Phone className="h-[13px] w-[13px]" strokeWidth={2} />
            {phone}
          </span>
        )}
      </div>

      {!isLost && <DealCardMoney transaction={t} onAddQuote={() => onAddQuote(t)} />}
      {stage === "Booked" && <DealCardRefs transaction={t} />}
      {!isLost && stage !== "Booked" && <DealCardTask transaction={t} onAddTask={() => onAddTask(t)} />}
      {stage === "Future" && (
        <p className="text-[12px] text-social-muted">
          Returns: <span className="font-medium text-foreground">{t.enquiry?.future_deal_date || t.quotes?.[0]?.future_deal_date || "—"}</span>
        </p>
      )}

      <DealCardFooter transaction={t} stage={stage} onSetPriority={(p) => onSetPriority(t, p)} onRestore={() => onRestore(t)} />
    </article>
  );
}
