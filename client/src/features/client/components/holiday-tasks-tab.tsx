import { useMemo, useState } from "react";
import { Check, Ellipsis, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTasks, useUsers, useCurrentUser } from "@/hooks/queries";
import { useToggleTask, useDeleteTask } from "@/hooks/mutations";
import { EditTaskDialog, TaskPriorityPill, type EditableTask } from "@/features/tasks";
import { AddTaskModal } from "@/components/shared/add-task-modal";

// ─── Tasks tab ──────────────────────────────────────────────────────────────
// Mock-styled task rows: toggle circle, orange due time – bold title, "Created"
// line, then a due chip, assignee-initials chip and a "···" menu on the right.
// Same data hooks as QuoteTasksSection; only the presentation differs.

export function taskDueChip(due: Date | string): { label: string; className: string } {
  const d = new Date(due);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
  if (dayDiff < 0) return { label: "Overdue", className: "bg-rose-500 text-white" };
  if (dayDiff === 0) return { label: "Today", className: "bg-emerald-500 text-white" };
  if (dayDiff === 1) return { label: "Tomorrow", className: "bg-sky-500 text-white" };
  return { label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), className: "bg-black/5 text-black/60" };
}

export function taskInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function HolidayTasksTab({ entityId, entityType, readOnly = false, hideCreateButton = false }: { entityId: string; entityType: "enquiry" | "quote" | "booking"; readOnly?: boolean; hideCreateButton?: boolean }) {
  // Booking tasks are stored under the "quote" entity type — same mapping
  // QuoteTasksSection applies.
  const taskEntityType = entityType === "booking" ? "quote" : entityType;
  const { data: tasksData, isLoading } = useTasks(taskEntityType, entityId);
  const { data: users = [] } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const toggleMutation = useToggleTask(taskEntityType, entityId);
  const deleteMutation = useDeleteTask(taskEntityType, entityId);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);
  const [showAddTask, setShowAddTask] = useState(false);

  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email || ""])), [users]);
  const tasks = useMemo(
    () => [...(tasksData || [])].sort((a, b) => Number(a.completed) - Number(b.completed)),
    [tasksData],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-[13px] text-black/40">No tasks yet.</p>
        {!readOnly && !hideCreateButton && (<Button
          size="sm"
          className="h-7 rounded-[10px] bg-avatar-blue-fg px-3 text-xs text-white hover:bg-avatar-blue-fg/90"
          data-testid="holiday-tasks-empty-new-task"
          onClick={() => setShowAddTask(true)}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Task
        </Button>)}
        {!readOnly && <AddTaskModal
          open={showAddTask}
          onOpenChange={setShowAddTask}
          entityType={taskEntityType}
          entityId={entityId}
          defaultAssignedToId={currentUser?.id}
        />}
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-black/[0.04]" data-testid="holiday-detail-tasks">
        {tasks.map((task) => {
          const due = task.dueDate ? new Date(task.dueDate) : null;
          const time = due && !isNaN(due.getTime()) ? due.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
          const chip = due && !isNaN(due.getTime()) && !task.completed ? taskDueChip(due) : null;
          const assigneeName = task.userId ? userNameById.get(task.userId) || "" : "";
          return (
            <div key={task.id} className="flex items-start gap-3 px-2 py-4" data-testid={`holiday-task-${task.id}`}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => toggleMutation.mutate(task.id)}
                title={task.completed ? "Mark as pending" : "Mark as done"}
                className={cn(
                  readOnly && "cursor-default",
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition",
                  task.completed
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-black/20 hover:border-emerald-500",
                )}
                data-testid={`holiday-task-toggle-${task.id}`}
              >
                {task.completed && <Check className="h-3 w-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-[13px] 3xl:text-[15px]">
                  {time && (
                    <>
                      <span className="shrink-0 font-bold text-orange-500">{time}</span>
                      <span className="text-black/30" aria-hidden>
                        –
                      </span>
                    </>
                  )}
                  <span className={cn("truncate font-semibold", task.completed ? "text-black/40 line-through" : "text-black/85")}>
                    {task.title}
                  </span>
                </div>
                {task.createdAt && (
                  <div className="mt-0.5 text-xs text-black/45">
                    Created {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <TaskPriorityPill priority={task.priority} testId={`holiday-task-priority-${task.id}`} />
                {chip && (
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", chip.className)} data-testid={`holiday-task-due-${task.id}`}>
                    {chip.label}
                  </span>
                )}
                {assigneeName && (
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700"
                    title={assigneeName}
                    data-testid={`holiday-task-assignee-${task.id}`}
                  >
                    {taskInitials(assigneeName)}
                  </span>
                )}
                {!readOnly && (<DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-[10px] text-black/40 transition hover:bg-black/5 hover:text-black"
                      title="More"
                      data-testid={`holiday-task-menu-${task.id}`}
                    >
                      <Ellipsis className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-[10px]">
                    <DropdownMenuItem onClick={() => setEditingTask(task)} className="gap-2 rounded-[10px] text-sm">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(task.id)}
                      className="gap-2 rounded-[10px] text-sm text-rose-600 focus:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>)}
              </div>
            </div>
          );
        })}
      </div>
      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        entityType={taskEntityType}
        entityId={entityId}
      />
    </>
  );
}
