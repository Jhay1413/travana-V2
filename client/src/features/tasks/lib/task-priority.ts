import type { TaskPriority } from "@shared/schema";

export type { TaskPriority };

export const DEFAULT_TASK_PRIORITY: TaskPriority = "medium";

export const TASK_PRIORITY_OPTIONS: ReadonlyArray<{ value: TaskPriority; label: string; pillClass: string }> = [
  { value: "low", label: "Low", pillClass: "bg-muted text-muted-foreground" },
  { value: "medium", label: "Medium", pillClass: "bg-muted text-muted-foreground" },
  { value: "high", label: "High", pillClass: "bg-ticket-amber-bg text-ticket-amber-fg" },
  { value: "urgent", label: "Urgent", pillClass: "bg-red-100 text-red-700" },
];

/** Medium is the default, so its pill is hidden to keep rows calm. */
export function showPriorityPill(priority: TaskPriority | null | undefined): priority is TaskPriority {
  return !!priority && priority !== DEFAULT_TASK_PRIORITY;
}

export function priorityLabel(priority: TaskPriority | null | undefined): string {
  return TASK_PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? "Medium";
}

export function priorityPillClass(priority: TaskPriority): string {
  return TASK_PRIORITY_OPTIONS.find((o) => o.value === priority)?.pillClass ?? "";
}
