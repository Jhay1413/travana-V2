import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { checklistProgress, checklistRows, type ChecklistRow } from "../lib/checklist";
import type { OnboardingChecklist } from "../types";
import { CARD_CLASS } from "./styles";

interface SetupChecklistCardProps {
  checklist: OnboardingChecklist;
  /** Called when an item's button is pressed. */
  onAction: (item: ChecklistRow) => void;
  /** Overrides the description of an open item (e.g. "You skipped this"). */
  describe?: (item: ChecklistRow) => string | undefined;
  onDismiss?: () => void;
  compact?: boolean;
  className?: string;
}

/** "Get started with Travana": the setup checklist shown on the Done screen and the admin dashboard. */
export function SetupChecklistCard({ checklist, onAction, describe, onDismiss, compact, className }: SetupChecklistCardProps) {
  const rows = checklistRows(checklist);
  const { done, total, percent } = checklistProgress(checklist);
  return (
    <section
      aria-label="Get started with Travana"
      data-testid="setup-checklist"
      className={cn(CARD_CLASS, compact && "!p-4 sm:!p-5", className)}
    >
      <div className="mb-3 flex items-center justify-between gap-6">
        <div>
          <div className={cn("font-semibold", compact ? "text-[15px]" : "text-[17px]")}>Get started with Travana</div>
          <div className="text-[13px] text-social-muted">
            {done} of {total} steps complete
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Progress value={percent} className="hidden w-[180px] bg-social-border sm:block [&>div]:bg-social-orange" aria-label="Setup progress" />
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-[13px] font-semibold text-social-muted hover:text-foreground"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
      <ol className="m-0 list-none p-0">
        {rows.map((item, i) => (
          <li key={item.key} className={cn("flex items-center gap-4 border-t border-social-border", compact ? "py-2.5" : "py-4")}>
            <span
              className={cn(
                "grid size-7 flex-none place-items-center rounded-full text-[13px]",
                item.isDone ? "bg-status-posted-fg text-white" : "border-[1.5px] border-social-border text-social-muted",
              )}
            >
              {item.isDone ? <Check className="size-4" aria-label="Complete" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn("text-[14px] font-semibold", item.isDone && "text-social-muted")}>{item.title}</div>
              <div className="text-[12px] text-social-muted">
                {item.isDone ? item.done : (describe?.(item) ?? item.todo)}
              </div>
            </div>
            {!item.isDone && item.actionLabel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-[10px] border-social-border bg-card text-[13px] font-semibold"
                onClick={() => onAction(item)}
              >
                {item.actionLabel}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
