import { useState } from "react";
import { useLocation } from "wouter";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NextTaskRow } from "@/components/shared/next-task-row";
import { AddTaskModal } from "@/components/shared/add-task-modal";
import { useCurrentUser } from "@/hooks/queries";
import type { Transaction } from "@/features/quote/types";
import {
  formatDate,
  getStageForTransaction,
  getTourOperator,
  getTransactionNavUrl,
  getTransactionTitle,
  type PipelineStage,
} from "@/features/pipeline/lib/pipeline-helpers";
import { buildDealMeta, nextTaskRowProps } from "@/features/pipeline/lib/deal-meta";
import { ICON_BUTTON } from "@/features/pipeline/shared/button-styles";
import { StagePill } from "@/features/pipeline/shared/stage-pill";
import { getTaskEntity } from "@/features/pipeline/lib/task-entity";
import { DrawerStageStepper } from "./drawer-stage-stepper";
import { DrawerCustomerCard } from "./drawer-customer-card";
import { DrawerMoney } from "./drawer-money";
import { DrawerFooter } from "./drawer-footer";
import { DrawerTourOperator } from "./drawer-tour-operator";
import { DrawerNotes } from "./drawer-notes";

function Label({ children }: { children: string }) {
  return <div className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">{children}</div>;
}

interface DealDrawerProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  onClose: () => void;
  onMove: (to: PipelineStage) => void;
  onMarkLost: () => void;
  onAddQuote: () => void;
  /** Open with the Add task pop-up already showing (from a card / row "+ Add task"). */
  initialAddTask?: boolean;
  /** Called after a task is created so the board can refresh its next-task line. */
  onTaskCreated?: () => void;
}

/** Right-hand quick view of a deal: summary, customer, money, operator, tasks and notes. */
export function DealDrawer({ transaction: t, stage, clientName, onClose, onMove, onMarkLost, onAddQuote, initialAddTask = false, onTaskCreated }: DealDrawerProps) {
  const [, setLocation] = useLocation();
  const [addTaskOpen, setAddTaskOpen] = useState(initialAddTask && !!getTaskEntity(t, stage).id);
  const { data: currentUser } = useCurrentUser();
  const navUrl = getTransactionNavUrl(t, stage);
  const naturalStage = stage === "Future" ? getStageForTransaction(t) : stage;
  const operator = getTourOperator(t);

  // Tasks attach to the stage-specific entity.
  // Booking tasks are stored under entityType "quote" with the booking's id
  // (see holiday-detail-view.tsx), so a Booked card must match that.
  const taskEntity = getTaskEntity(t, stage);

  const openFull = () => { onClose(); setLocation(navUrl); };
  const firstName = clientName.split(" ")[0] || clientName;

  return (
    <>
      <div className="fixed inset-0 z-[500] bg-black/20" onClick={onClose} data-testid="panel-backdrop" />
      <aside
        className="animate-in slide-in-from-right fixed bottom-0 right-0 top-0 z-[501] flex w-[580px] max-w-[94vw] flex-col bg-card shadow-[-12px_0_32px_rgba(30,41,59,.18)] duration-300"
        data-testid="transaction-detail-panel"
        aria-label={`${getTransactionTitle(t)} deal`}
      >
        <div className="relative flex-none border-b border-pipeline-card-border px-7 pb-3.5 pt-6">
          <button type="button" aria-label="Close" onClick={onClose} className={cn(ICON_BUTTON, "absolute right-6 top-5")} data-testid="button-close-panel">
            <X className="h-4 w-4" />
          </button>
          <div className="mb-2 flex items-center gap-2.5">
            <StagePill stage={stage} />
            <span className="text-[12px] text-social-muted">Deal #{t.id.slice(0, 8)} · created {formatDate(t.created_at)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 pr-12">
            <h2 className="text-[20px] font-semibold xl:text-[22px]">{getTransactionTitle(t)}</h2>
            <button type="button" onClick={openFull} className="inline-flex items-center gap-1 text-[13px] text-social-orange-text hover:underline" data-testid="button-open-full">
              Open full deal<ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="mt-0.5 text-[12px] text-social-muted">{buildDealMeta(t, naturalStage)}</div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-5 pt-4">
          {stage !== "Lost" && <DrawerStageStepper stage={naturalStage} />}

          <Label>Customer</Label>
          <DrawerCustomerCard transaction={t} clientName={clientName} />

          <Label>Money</Label>
          <DrawerMoney transaction={t} onAddQuote={onAddQuote} />

          {(t.quotes?.length || t.booking || operator.name || operator.logoUrl) && (
            <>
              <Label>Tour operator</Label>
              <DrawerTourOperator transaction={t} operator={operator} onOpen={openFull} />
            </>
          )}

          <Label>Next task</Label>
          <NextTaskRow
            size="drawer"
            {...nextTaskRowProps(t.next_task)}
            onOpenQuote={openFull}
            quoteLabel={naturalStage === "Enquiry" ? "View deal" : "View quote"}
            onAddTask={taskEntity.id ? () => setAddTaskOpen(true) : undefined}
            testId="drawer-next-task"
          />

          <Label>Notes</Label>
          <DrawerNotes transactionId={t.id} firstName={firstName} />
        </div>

        <DrawerFooter stage={stage} naturalStage={naturalStage} onMarkLost={onMarkLost} onMove={onMove} onClose={onClose} />
      </aside>

      <AddTaskModal
        title="Add task"
        subtitle={`${getTransactionTitle(t)} · ${clientName}`}
        entityType={taskEntity.id ? taskEntity.type : undefined}
        entityId={taskEntity.id}
        assignedToId={t.user_id || currentUser?.id}
        successToast="Task added"
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        onCreated={onTaskCreated}
        testIdPrefix="drawer-add-task"
      />
    </>
  );
}
