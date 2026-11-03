import { cn } from "@/lib/utils";
import { priorityLabel, priorityPillClass, showPriorityPill, type TaskPriority } from "@/features/tasks/lib/task-priority";

/** Small priority pill; renders nothing for medium/unknown so rows stay calm. */
export function TaskPriorityPill({ priority, className, testId }: { priority: TaskPriority | null | undefined; className?: string; testId?: string }) {
  if (!showPriorityPill(priority)) return null;
  return (
    <span
      className={cn("shrink-0 whitespace-nowrap rounded-full px-2 py-px text-[10.5px] font-semibold", priorityPillClass(priority), className)}
      data-testid={testId}
    >
      {priorityLabel(priority)}
    </span>
  );
}
