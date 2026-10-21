import { CalendarDays, ExternalLink, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDueDateTime, isDueToday } from "@/lib/task-due-format";
import { AMBER_LINK } from "@/components/shared/link-styles";

export interface NextTaskRowProps {
  title: string | null;
  dueDate: string | null;
  size?: "card" | "drawer";
  onAddTask?: () => void;
  /** Shows a right-aligned link on a task row that runs this (e.g. opens the quote / deal). */
  onOpenQuote?: () => void;
  /** Label for the link (default "View quote"). */
  quoteLabel?: string;
  testId?: string;
}

/** "Next task" box: the task with a "Today" pill, or a dashed "No task scheduled" prompt. */
export function NextTaskRow({ title, dueDate, size = "card", onAddTask, onOpenQuote, quoteLabel = "View quote", testId }: NextTaskRowProps) {
  const drawer = size === "drawer";
  const hasTask = title !== null || dueDate !== null;

  if (hasTask) {
    return (
      <div
        className={cn(
          "flex items-center bg-pipeline-task-bg",
          drawer ? "gap-3 rounded-xl px-3 py-2.5" : "gap-[9px] rounded-[10px] px-2.5 py-2",
        )}
        data-testid={testId}
      >
        <CalendarDays className={cn("shrink-0 text-stage-quoted-dot", drawer ? "h-[17px] w-[17px]" : "h-4 w-4")} strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className={cn("line-clamp-2 font-semibold leading-[1.3]", drawer ? "text-[13px]" : "text-[12.5px]")}>
            {title || "Untitled task"}
          </div>
          <div className="whitespace-nowrap text-[12px] text-social-muted">{formatDueDateTime(dueDate)}</div>
        </div>
        {isDueToday(dueDate) && (
          <span className="whitespace-nowrap rounded-full bg-ticket-amber-bg px-2 py-px text-[11px] font-semibold text-ticket-amber-fg">Today</span>
        )}
        {onOpenQuote && (
          <button
            type="button"
            className={cn(AMBER_LINK, "ml-auto inline-flex items-center gap-1")}
            onClick={(e) => { e.stopPropagation(); onOpenQuote(); }}
          >
            {quoteLabel}<ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-[1.5px] border-dashed border-pipeline-notask-border bg-pipeline-notask-bg text-[12.5px] font-medium text-ticket-amber-fg",
        drawer ? "rounded-xl px-3 py-2.5" : "rounded-[10px] px-2.5 py-[9px]",
      )}
      data-testid={testId}
    >
      <TriangleAlert className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
      <span className="flex-1 whitespace-nowrap">No task scheduled</span>
      {onAddTask &&
        (drawer ? (
          <button
            type="button"
            className="h-[34px] rounded-[10px] border border-social-border bg-card px-3.5 text-[13px] font-semibold text-foreground hover:bg-muted"
            onClick={(e) => { e.stopPropagation(); onAddTask(); }}
            data-testid={testId ? `${testId}-add` : undefined}
          >
            + Add task
          </button>
        ) : (
          <button
            type="button"
            className={AMBER_LINK}
            onClick={(e) => { e.stopPropagation(); onAddTask(); }}
            data-testid={testId ? `${testId}-add` : undefined}
          >
            + Add task
          </button>
        ))}
    </div>
  );
}
