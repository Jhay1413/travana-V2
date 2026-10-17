import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { InitialsAvatar } from "@/features/agent-overview/components/dashboard-ui";
import type { Transaction } from "@/features/quote/types";
import { getAssigneeName, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { quietDays, quietLabel, quietTone } from "@/features/pipeline/lib/quiet";
import { AMBER_LINK } from "@/features/pipeline/shared/button-styles";
import { NiceOneBadge, PriorityControl } from "./deal-card-menu";

type Priority = "low" | "medium" | "high";

/** "n days quiet" — amber from 7 days, red from 14; hidden for active deals. */
export function QuietLabel({ lastActivityAt }: { lastActivityAt: string | null | undefined }) {
  const days = quietDays(lastActivityAt);
  if (days === null || days < 1) return null;
  const tone = quietTone(days);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[12px]",
        tone === "ok" && "font-medium text-social-muted",
        tone === "warn" && "font-semibold text-stage-inplay-fg",
        tone === "danger" && "font-semibold text-stage-lost-fg",
      )}
    >
      <Clock className="h-[13px] w-[13px]" strokeWidth={2} />
      {quietLabel(days)}
    </span>
  );
}

/** Bottom row of a card: owner, priority (or Nice one!), quiet days / Reopen. */
export function DealCardFooter({
  transaction: t,
  stage,
  onSetPriority,
  onRestore,
}: {
  transaction: Transaction;
  stage: PipelineStage;
  onSetPriority: (priority: Priority) => void;
  onRestore: () => void;
}) {
  const priority: Priority = t.priority || "low";
  const avatar = <InitialsAvatar name={getAssigneeName(t)} solid className="h-6 w-6 text-[10px]" />;

  if (stage === "Lost") {
    return (
      <div className="flex items-center gap-2">
        <QuietLabel lastActivityAt={t.last_activity_at} />
        <span className="flex-1" />
        <button type="button" className={AMBER_LINK} onClick={(e) => { e.stopPropagation(); onRestore(); }} data-testid={`button-reopen-${t.id}`}>
          Reopen
        </button>
      </div>
    );
  }
  if (stage === "Booked") {
    return (
      <div className="flex items-center gap-2.5">
        {avatar}
        <NiceOneBadge />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      {avatar}
      <PriorityControl priority={priority} onChange={onSetPriority} />
      <span className="flex-1" />
      <QuietLabel lastActivityAt={t.last_activity_at} />
    </div>
  );
}
