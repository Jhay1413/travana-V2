import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CalendarCheck, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { InitialsAvatar } from "@/features/agent-overview/components/dashboard-ui";
import { useSetPrimaryQuote } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@/features/quote/types";
import {
  formatCurrency,
  formatDueDateTime,
  formatNoActivityLabel,
  getAssigneeName,
  getEnquiryBudget,
  getTourOperator,
  getTransactionNavUrl,
  getTransactionProfit,
  getTransactionTitle,
  getTransactionValue,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";
import { DealCardOverflowMenu, NiceOneBadge, PriorityControl } from "@/features/pipeline/components/deal-card-menu";

type Priority = "low" | "medium" | "high";

const OPERATOR_PALETTE = ["bg-red-500", "bg-sky-500", "bg-orange-500", "bg-emerald-600", "bg-indigo-500"];

function OperatorChip({ name }: { name: string | null }) {
  const label = (name || "•")[0]?.toUpperCase() || "•";
  const hash = [...(name || "x")].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span
      className={cn("grid h-7 w-7 shrink-0 place-items-center  text-[11px] 3xl:h-[30px] 3xl:w-[30px] 3xl:text-xs font-bold text-white", OPERATOR_PALETTE[hash % OPERATOR_PALETTE.length])}
      title={name || undefined}
      aria-hidden
    >
      {label}
    </span>
  );
}

function OperatorMark({ name, logoUrl }: { name: string | null; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) return <OperatorChip name={name} />;
  return (
    <img
      src={logoUrl}
      alt={name || "Tour operator"}
      title={name || undefined}
      onError={() => setFailed(true)}
      className="h-7 w-7 shrink-0  border border-black/10 bg-white object-contain 3xl:h-[30px] 3xl:w-[30px]"
    />
  );
}

export interface DealCardProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  onDragStart: (t: Transaction, stage: PipelineStage) => void;
  onCardClick: (t: Transaction, stage: PipelineStage) => void;
  onSetPriority: (t: Transaction, priority: Priority) => void;
  onMoveToFuture: (t: Transaction) => void;
  onReturnToPipeline: (t: Transaction) => void;
  onMarkLost: (t: Transaction) => void;
  onRestore: (t: Transaction) => void;
}

export function DealCard({
  transaction: t,
  stage,
  clientName,
  onDragStart,
  onCardClick,
  onSetPriority,
  onMoveToFuture,
  onReturnToPipeline,
  onMarkLost,
  onRestore,
}: DealCardProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const setPrimaryQuoteMutation = useSetPrimaryQuote();
  const [isDragging, setIsDragging] = useState(false);
  const [showQuotes, setShowQuotes] = useState(false);
  const quotesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (quotesRef.current && !quotesRef.current.contains(e.target as Node)) setShowQuotes(false);
    };
    if (showQuotes) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showQuotes]);

  const { name: operatorName, logoUrl: operatorLogo } = getTourOperator(t);
  const showOperator = stage !== "Enquiry" && !!(operatorName || operatorLogo);
  const enquiryBudget = stage === "Enquiry" ? getEnquiryBudget(t) : null;
  const cost = getTransactionValue(t);
  const profit = getTransactionProfit(t);
  const quoteVariants = t.quote_variants || [];
  const duplicateCount = quoteVariants.filter((q) => q.isQuoteCopy).length;
  const priority: Priority = t.priority || "low";
  const navUrl = getTransactionNavUrl(t, stage);

  return (
    <div
      className={cn(
        "group relative cursor-grab rounded-md border border-black/10 bg-white p-3 shadow-sm active:cursor-grabbing 3xl:p-3.5",
        isDragging && "opacity-40",
      )}
      draggable
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
      {/* Row 1: title + operator logo/hover actions */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#2196c4] 3xl:text-[15px]" data-testid={`pipeline-title-${t.id}`}>
          {getTransactionTitle(t)}
        </h4>
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              className="rounded-md p-1 hover:bg-black/[0.06]"
              onClick={(e) => { e.stopPropagation(); setLocation(navUrl); }}
              data-testid={`button-view-deal-${t.id}`}
            >
              <Eye className="h-3.5 w-3.5 text-black/50" />
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
          {showOperator && <OperatorMark name={operatorName} logoUrl={operatorLogo} />}
        </div>
      </div>

      {/* Name / Budget / Cost / Profit */}
      <div className="mt-1.5 space-y-0.5 text-xs 3xl:text-[13px]">
        <p className="truncate">
          <span className="font-medium text-black/80">Name: </span>
          <span className="text-black/70">{clientName}</span>
        </p>
        {stage === "Enquiry" ? (
          enquiryBudget !== null && (
            <p>
              <span className="font-medium text-black/80">Budget: </span>
              <span className="text-black/70">{formatCurrency(enquiryBudget)}</span>
            </p>
          )
        ) : (
          <p>
            <span className="font-medium text-black/80">Cost: </span>
            <span className="text-black/70">{cost > 0 ? formatCurrency(cost) : "TBC"}</span>
          </p>
        )}
        {profit > 0 && (
          <p>
            <span className="font-medium text-black/80">Profit: </span>
            <span className="text-[#22a06b]">{formatCurrency(profit)}</span>
          </p>
        )}
      </div>

      {duplicateCount > 0 && (stage === "Quoted" || stage === "In Play") && (
        <div className="relative mt-1" ref={quotesRef}>
          <button
            type="button"
            className="flex items-center justify-center rounded-full bg-[#2196c4] px-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#2196c4]/90"
            style={{ minWidth: 22, height: 22 }}
            onClick={(e) => { e.stopPropagation(); setShowQuotes((v) => !v); }}
            title={`${duplicateCount} duplicate quote${duplicateCount > 1 ? "s" : ""}`}
            data-testid={`button-duplicate-quotes-${t.id}`}
          >
            +{duplicateCount}
          </button>
          {showQuotes && (
            <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
              {quoteVariants.map((q) => {
                const isPrimary = q.isQuoteCopy === false;
                return (
                  <div key={q.id} className="group/qv flex w-full items-center gap-1 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowQuotes(false);
                        if (t.client_id) setLocation(`/clients/${t.client_id}?holiday=quote:${q.id}`);
                      }}
                    >
                      <span className="truncate text-xs text-gray-700">{q.title || "Untitled quote"}</span>
                      {isPrimary && (
                        <span className="ml-auto shrink-0 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">Primary</span>
                      )}
                    </button>
                    {!isPrimary && (
                      <button
                        type="button"
                        className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-gray-400 opacity-0 transition-colors hover:bg-indigo-50 hover:text-indigo-600 group-hover/qv:opacity-100"
                        title="Set as main"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowQuotes(false);
                          setPrimaryQuoteMutation.mutate(q.id, {
                            onSuccess: () => toast({ title: "Primary quote updated" }),
                            onError: () => toast({ title: "Failed to set primary", variant: "destructive" }),
                          });
                        }}
                      >
                        Set as main
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="my-2 h-px bg-black/10 3xl:my-2.5" />

      {/* Footer: assignee + task indicator | priority / nice one */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <InitialsAvatar name={getAssigneeName(t)} solid className="h-5 w-5 text-[10px] 3xl:h-6 3xl:w-6 3xl:text-xs" />
          {t.next_task && <CalendarCheck className="h-3.5 w-3.5 text-[#2196c4]" />}
        </div>
        {stage === "Booked" ? (
          <NiceOneBadge />
        ) : (
          <PriorityControl priority={priority} onChange={(p) => onSetPriority(t, p)} />
        )}
      </div>

      {/* Activity / task / booking-ref / future-return lines */}
      <div className="mt-2 space-y-0.5 text-xs text-black/70 3xl:text-[13px]">
        {stage === "Booked" ? (
          <>
            <p><span className="font-medium text-black/80">Hays: </span>{t.booking?.hays_ref || "—"}</p>
            <p><span className="font-medium text-black/80">Tour Ref: </span>{t.booking?.supplier_ref || "—"}</p>
          </>
        ) : t.next_task ? (
          <>
            <p><span className="font-medium text-black/80">Task: </span>{t.next_task.title || "Untitled task"}</p>
            <p><span className="font-medium text-black/80">Time &amp; Date: </span>{formatDueDateTime(t.next_task.due_date)}</p>
          </>
        ) : (
          <>
            <p>{formatNoActivityLabel(t.last_activity_at)}</p>
            <p className="font-medium text-black/80">! No activity scheduled</p>
          </>
        )}
        {stage === "Future" && (
          <p><span className="font-medium text-black/80">Returns: </span>{t.enquiry?.future_deal_date || t.quotes?.[0]?.future_deal_date || "—"}</p>
        )}
      </div>
    </div>
  );
}
