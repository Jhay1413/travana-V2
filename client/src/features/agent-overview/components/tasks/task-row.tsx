import { Check, Ellipsis } from "lucide-react";
import type { TaskWithClient } from "@/features/tasks/api/task.api";
import { formatDueDateTime } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { TaskPriorityPill } from "@/features/tasks";
import { PersonAvatar, RowButton } from "../home/home-ui";
import { currency } from "../helpers";

function fmtDate(d?: string | Date | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function taskMeta(task: TaskWithClient): string {
  return [
    `Created ${fmtDate(task.createdAt) ?? "—"}`,
    task.entityTitle,
    task.entityTravelDate ? `Travel ${fmtDate(task.entityTravelDate)}` : null,
    task.entityPrice != null && task.entityPrice !== "" ? currency.format(parseFloat(task.entityPrice) || 0) : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

/** One task: round check, "<when> · <customer> · <title>", meta line, avatar and edit button. */
export function TaskRow({
  task,
  isDone,
  isOverdue,
  onOpen,
  onEdit,
  onComplete,
}: {
  task: TaskWithClient;
  isDone: boolean;
  isOverdue: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onComplete: () => void;
}) {
  const when = task.dueDate ? formatDueDateTime(String(task.dueDate)) : "No date";
  return (
    <RowButton
      onActivate={onOpen}
      className={cn(
        "group flex items-center gap-3 rounded-none border-t border-social-border px-0 py-3 hover:bg-social-page xl:gap-3.5 xl:py-3.5",
        isDone && "opacity-50",
      )}
      testId={`row-dashboard-task-${task.id}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={isDone}
        aria-label={isDone ? "Task completed" : "Mark task complete"}
        disabled={isDone}
        onClick={(e) => {
          e.stopPropagation();
          onComplete();
        }}
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] transition",
          isDone
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-dashboard-check bg-card hover:border-emerald-500",
        )}
        data-testid={`button-complete-dashboard-task-${task.id}`}
      >
        {isDone && <Check className="h-3 w-3" strokeWidth={3.5} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] xl:text-[14px]">
          <b className={cn("font-semibold", isOverdue ? "text-red-600" : "text-social-orange-text")}>{when}</b>
          {task.clientName && (
            <>
              <span className="mx-1.5 text-social-muted">·</span>
              <b className="font-semibold">{task.clientName}</b>
            </>
          )}
          <span className="mx-1.5 text-social-muted">·</span>
          <span className={cn(isDone && "line-through")} data-testid={`text-dashboard-task-title-${task.id}`}>
            {task.title}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-social-muted xl:text-[12px]">{taskMeta(task)}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <TaskPriorityPill priority={task.priority} testId={`pill-dashboard-task-priority-${task.id}`} />
        <PersonAvatar name={task.clientName || task.title} size={34} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="grid h-7 w-7 place-items-center rounded-full text-social-muted transition hover:bg-muted hover:text-foreground"
          aria-label="Edit task"
          data-testid={`button-edit-dashboard-task-${task.id}`}
        >
          <Ellipsis className="h-4 w-4" />
        </button>
      </div>
    </RowButton>
  );
}
