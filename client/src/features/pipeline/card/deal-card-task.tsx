import { CalendarDays, TriangleAlert } from "lucide-react";
import type { Transaction } from "@/features/quote/types";
import { formatDueDateTime } from "@/features/pipeline/lib/pipeline-helpers";
import { isDueToday } from "@/features/pipeline/lib/deal-meta";
import { AMBER_LINK } from "@/features/pipeline/shared/button-styles";

/** Next-task row on a card: the task with a "Today" pill, or a dashed "No task scheduled" prompt. */
export function DealCardTask({ transaction: t, onAddTask }: { transaction: Transaction; onAddTask: () => void }) {
  const task = t.next_task;
  if (task) {
    return (
      <div className="flex items-center gap-[9px] rounded-[10px] bg-pipeline-task-bg px-2.5 py-2">
        <CalendarDays className="h-4 w-4 shrink-0 text-stage-quoted-dot" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-[12.5px] font-semibold leading-[1.3]">{task.title || "Untitled task"}</div>
          <div className="whitespace-nowrap text-[12px] text-social-muted">{formatDueDateTime(task.due_date)}</div>
        </div>
        {isDueToday(task.due_date) && (
          <span className="whitespace-nowrap rounded-full bg-stage-inplay-bg px-2 py-px text-[11px] font-semibold text-stage-inplay-fg">Today</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-[10px] border-[1.5px] border-dashed border-pipeline-notask-border bg-pipeline-notask-bg px-2.5 py-[9px] text-[12.5px] font-medium text-stage-inplay-fg">
      <TriangleAlert className="h-[15px] w-[15px] shrink-0" strokeWidth={2} />
      <span className="flex-1 whitespace-nowrap">No task scheduled</span>
      <button type="button" className={AMBER_LINK} onClick={(e) => { e.stopPropagation(); onAddTask(); }} data-testid={`button-add-task-${t.id}`}>
        + Add task
      </button>
    </div>
  );
}
