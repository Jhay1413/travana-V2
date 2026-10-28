import { useMemo, useState } from "react";
import { Check, Ellipsis, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { visibleRows } from "@/lib/visible-rows";
import { useDeleteTask, useToggleTask } from "@/hooks/mutations";
import { EditTaskDialog, type EditableTask } from "@/features/tasks/components/tasks/EditTaskDialog";
import type { User as ApiUser } from "@/features/user/types";
import type { TaskNew } from "@shared/schema";
import { longDate, sortTasks, taskDueChip } from "@/features/client/lib/task-rows";
import { taskLinkFor, type TaskHolidayInfo } from "@/features/client/lib/deal-labels";

const TASKS_PREVIEW_LIMIT = 5;

interface TasksTabProps {
  clientId: string;
  tasks: TaskNew[];
  users: ApiUser[];
  holidays: Map<string, TaskHolidayInfo>;
  readOnly: boolean;
}

export function TasksTab({ clientId, tasks, users, holidays, readOnly }: TasksTabProps) {
  const [, navigate] = useLocation();
  const toggleMutation = useToggleTask("client", clientId);
  const deleteMutation = useDeleteTask("client", clientId);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);
  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email || ""])), [users]);
  const [expandedRaw, setExpanded] = useState(false);
  const sorted = useMemo(() => sortTasks(tasks), [tasks]);
  // Expanded only means something while the list is longer than the preview.
  const expanded = expandedRaw && sorted.length > TASKS_PREVIEW_LIMIT;
  const rows = visibleRows(sorted, expanded, TASKS_PREVIEW_LIMIT);

  if (rows.length === 0) {
    return <p className="border-t border-social-border py-6 text-sm text-social-muted">No tasks yet.</p>;
  }

  return (
    <>
      <div className={expanded ? "max-h-[60vh] overflow-y-auto" : undefined} data-testid="client-index-tasks">
        {rows.map((task) => {
          const due = task.dueDate ? new Date(task.dueDate) : null;
          const validDue = due && !Number.isNaN(due.getTime()) ? due : null;
          const time = validDue ? validDue.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
          const chip = validDue && !task.completed ? taskDueChip(validDue) : null;
          const assigneeName = task.userId ? userNameById.get(task.userId) || "" : "";
          const created = longDate(task.createdAt ? String(task.createdAt) : null);
          const holiday = task.entityId ? holidays.get(task.entityId) : undefined;
          const travel = holiday?.travelDate ? longDate(holiday.travelDate) : null;
          const meta = [created ? `Created ${created}` : null, holiday?.title || null, travel ? `Travel ${travel}` : null]
            .filter(Boolean)
            .join(" – ");
          const href = taskLinkFor(task, holidays, clientId);
          return (
            <div
              key={task.id}
              className={cn("flex items-center gap-3.5 border-t border-social-border py-4", href && "cursor-pointer transition hover:bg-muted/40")}
              onClick={href ? () => navigate(href) : undefined}
              {...(href && {
                role: "link",
                tabIndex: 0,
                onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(href);
                  }
                },
              })}
              data-testid={`client-index-task-${task.id}`}
            >
              <button
                type="button"
                disabled={readOnly}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMutation.mutate(task.id);
                }}
                title={task.completed ? "Mark as pending" : "Mark as done"}
                aria-label={task.completed ? "Mark as pending" : "Mark as done"}
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full border-[1.5px] transition",
                  task.completed ? "border-status-scheduled-fg bg-status-scheduled-fg text-white" : "border-slate-300 hover:border-status-scheduled-fg",
                  readOnly && "cursor-default",
                )}
                data-testid={`client-index-task-toggle-${task.id}`}
              >
                {task.completed && <Check className="h-3.5 w-3.5" strokeWidth={2.4} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={cn("flex items-baseline gap-2 text-sm", task.completed && "text-social-muted line-through")}>
                  {time && <span className="shrink-0 font-semibold text-social-orange-text">{time}</span>}
                  {time && <span aria-hidden>·</span>}
                  <span className="truncate">{task.title}</span>
                </div>
                {meta && <div className="mt-0.5 truncate text-xs text-social-muted">{meta}</div>}
              </div>
              {chip && (
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", chip.className)} data-testid={`client-index-task-due-${task.id}`}>
                  {chip.label}
                </span>
              )}
              {assigneeName && <PersonAvatar name={assigneeName} size={34} />}
              {!readOnly && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Task actions"
                      onClick={(e) => e.stopPropagation()}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-social-muted transition hover:bg-muted hover:text-foreground"
                      data-testid={`client-index-task-menu-${task.id}`}
                    >
                      <Ellipsis className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => setEditingTask(task)} className="gap-2">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteMutation.mutate(task.id)} className="gap-2 text-destructive focus:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>
      {sorted.length > TASKS_PREVIEW_LIMIT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-[13px] font-semibold text-social-orange-text transition hover:underline"
          data-testid="client-index-view-all-tasks"
        >
          {expanded ? "Show less" : `View all tasks (${sorted.length})`}
        </button>
      )}
      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        entityType="client"
        entityId={clientId}
      />
    </>
  );
}
