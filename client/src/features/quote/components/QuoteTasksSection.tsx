import { useMemo, useState } from "react";
import { CheckSquare, Circle, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useTasks, useCurrentUser } from "@/hooks/queries";
import { useToggleTask, useDeleteTask } from "@/hooks/mutations";
import { CreateTaskDialog } from "@/features/tasks/components/tasks/CreateTaskDialog";
import { EditTaskDialog, type EditableTask } from "@/features/tasks/components/tasks/EditTaskDialog";
import { cn } from "@/lib/utils";

function formatTaskDue(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 0) return "Overdue";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function QuoteTasksSection({ quoteId, entityType = "quote", assignedUserId, addOpen, onAddOpenChange, hideAddButton, className }: { quoteId: string; entityType?: "enquiry" | "quote" | "booking"; assignedUserId?: string; addOpen?: boolean; onAddOpenChange?: (open: boolean) => void; hideAddButton?: boolean; className?: string }) {
  const taskEntityType = entityType === "booking" ? "quote" : entityType;
  const { data: tasksData, isLoading } = useTasks(taskEntityType, quoteId);
  const { data: currentUser } = useCurrentUser();
  const toggleMutation = useToggleTask(taskEntityType, quoteId);
  const deleteMutation = useDeleteTask(taskEntityType, quoteId);
  // The add-task dialog can be controlled by a parent (e.g. opened from the
  // quote Actions dropdown) or managed internally via the in-card button.
  const [internalShowAddDialog, setInternalShowAddDialog] = useState(false);
  const isAddControlled = onAddOpenChange !== undefined;
  const showAddDialog = isAddControlled ? !!addOpen : internalShowAddDialog;
  const setShowAddDialog = (open: boolean) => {
    if (isAddControlled) onAddOpenChange!(open);
    else setInternalShowAddDialog(open);
  };
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);

  const pendingTasks = useMemo(() => (tasksData || []).filter((t) => !t.completed), [tasksData]);
  const completedTasks = useMemo(() => (tasksData || []).filter((t) => t.completed), [tasksData]);

  return (
    <>
      <Card className={cn("glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4", className)} data-testid="card-quote-tasks">
        <div className="flex items-center justify-between" data-testid="row-tasks-header">
          <div>
            <div className="text-sm font-semibold" data-testid="text-tasks-title">Tasks</div>
            <div className="mt-1 text-xs text-black/55" data-testid="text-tasks-subtitle">Track to-dos for this {entityType}.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-black/50" data-testid="text-tasks-count">
              {pendingTasks.length}
            </span>
            <CheckSquare className="h-4 w-4 text-black/35" aria-hidden />
          </div>
        </div>

        <div className="mt-3 grid gap-1.5" data-testid="list-tasks">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner className="h-4 w-4" />
            </div>
          ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 py-4 text-center" data-testid="text-tasks-empty">
              <span className="text-xs text-black/40">No tasks yet.</span>
              <Button
                size="sm"
                className="h-7 rounded-lg bg-[#3b82f6] px-3 text-xs text-white hover:bg-[#3b82f6]/90"
                data-testid="button-empty-new-task"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Task
              </Button>
            </div>
          ) : (
            <>
              {pendingTasks.map((task) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.02]"
                    data-testid={`row-task-${task.id}`}
                  >
                    <button type="button" onClick={() => toggleMutation.mutate(task.id)} className="shrink-0" data-testid={`button-toggle-task-${task.id}`}>
                      <Circle className="h-3.5 w-3.5 text-black/30" />
                    </button>
                    <span className="flex-1 text-xs font-medium text-black/75" data-testid={`text-task-label-${task.id}`}>
                      {task.title}
                    </span>
                    <span className={`shrink-0 text-[10px] font-semibold ${isOverdue ? "text-rose-500" : "text-black/40"}`} data-testid={`text-task-due-${task.id}`}>
                      {task.dueDate ? formatTaskDue(task.dueDate) : ""}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-black/25 opacity-0 transition hover:bg-black/[0.06] hover:text-black/60 group-hover:opacity-100"
                      data-testid={`button-edit-task-${task.id}`}
                      onClick={() => setEditingTask(task)}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-black/25 opacity-0 transition hover:bg-black/[0.06] hover:text-black/60 group-hover:opacity-100"
                      data-testid={`button-remove-task-${task.id}`}
                      onClick={() => deleteMutation.mutate(task.id)}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                );
              })}
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.02]"
                  data-testid={`row-task-${task.id}`}
                >
                  <button type="button" onClick={() => toggleMutation.mutate(task.id)} className="shrink-0" data-testid={`button-toggle-task-${task.id}`}>
                    <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                  </button>
                  <span className="flex-1 text-xs font-medium text-black/40 line-through" data-testid={`text-task-label-${task.id}`}>
                    {task.title}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-black/25 opacity-0 transition hover:bg-black/[0.06] hover:text-black/60 group-hover:opacity-100"
                    data-testid={`button-remove-task-${task.id}`}
                    onClick={() => deleteMutation.mutate(task.id)}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {!hideAddButton && (
          <div className="mt-3">
            <Button
              size="sm"
              className="w-full h-9 rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
              data-testid="button-add-task"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Task
            </Button>
          </div>
        )}
      </Card>

      <CreateTaskDialog
        presentation="drawer"
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        entityType={taskEntityType}
        entityId={quoteId}
        defaultAssignedToId={assignedUserId ?? currentUser?.id}
      />

      <EditTaskDialog
        presentation="drawer"
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        entityType={taskEntityType}
        entityId={quoteId}
      />
    </>
  );
}
