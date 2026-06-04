import { useMemo, useState } from "react";
import { CheckSquare, Circle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTasks, useCurrentUser } from "@/hooks/queries";
import { useCreateTask, useToggleTask, useDeleteTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { cn } from "@/lib/utils";

const TASK_CATEGORIES = [
  { value: "general", label: "General Task" },
  { value: "enquiry", label: "Enquiry" },
  { value: "quote", label: "Quote" },
  { value: "booking", label: "Booking" },
];

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
  const createMutation = useCreateTask(taskEntityType, quoteId);
  const toggleMutation = useToggleTask(taskEntityType, quoteId);
  const deleteMutation = useDeleteTask(taskEntityType, quoteId);
  const { toast } = useToast();
  // The add-task dialog can be controlled by a parent (e.g. opened from the
  // quote Actions dropdown) or managed internally via the in-card button.
  const [internalShowAddDialog, setInternalShowAddDialog] = useState(false);
  const isAddControlled = onAddOpenChange !== undefined;
  const showAddDialog = isAddControlled ? !!addOpen : internalShowAddDialog;
  const setShowAddDialog = (open: boolean) => {
    if (isAddControlled) onAddOpenChange!(open);
    else setInternalShowAddDialog(open);
  };
  const [taskCategory, setTaskCategory] = useState<string>(entityType);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("09:00");
  const [assignedToId, setAssignedToId] = useState("");

  const handleAdd = () => {
    const userIdForTask = assignedToId || assignedUserId || currentUser?.id;
    if (!newTitle || !newDueDate || !userIdForTask) return;
    const dueDate = new Date(`${newDueDate}T${newDueTime || "09:00"}`);
    createMutation.mutate(
      {
        entityType: taskEntityType,
        entityId: quoteId,
        userId: userIdForTask,
        title: newTitle,
        dueDate: dueDate,
        completed: false,
        notified: false,
      } as any,
      {
        onSuccess: () => {
          setShowAddDialog(false);
          setNewTitle("");
          setNewDueDate("");
          setNewDueTime("09:00");
          setAssignedToId("");
          toast({ title: "Task added" });
        },
        onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
      }
    );
  };

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
            <div className="py-4 text-center text-xs text-black/40" data-testid="text-tasks-empty">
              No tasks yet.
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-add-task">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Add Task</DialogTitle>
            <DialogDescription className="text-xs text-black/55">
              Set a task with a due date and time.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Category</Label>
              <Select value={taskCategory} onValueChange={setTaskCategory}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-task-category">
                  <SelectValue placeholder="Choose a category…" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Task</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter a task…"
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-task-title"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Assign To</Label>
              <UserReassignSelect
                value={assignedToId || assignedUserId || currentUser?.id || ""}
                onValueChange={setAssignedToId}
                data-testid="select-task-assign-to"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Due Date</Label>
                <DatePicker
                  value={newDueDate}
                  onChange={(v) => setNewDueDate(v)}
                  placeholder="Pick a date"
                  data-testid="input-task-due-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Due Time</Label>
                <Input
                  type="time"
                  value={newDueTime}
                  onChange={(e) => setNewDueTime(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-task-due-time"
                />
              </div>
            </div>

            <Button
              className="h-9 w-full rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
              data-testid="button-confirm-add-task"
              onClick={handleAdd}
              disabled={!newTitle || !newDueDate || createMutation.isPending}
            >
              {createMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Add Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
