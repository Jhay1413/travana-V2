import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { useUpdateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

export interface EditableTask {
  id: string;
  title: string | null;
  dueDate: Date | string | null;
  userId: string | null;
  completed?: boolean | null;
}

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: EditableTask | null;
  /** Entity the task belongs to — used to invalidate the right cached lists. */
  entityType: string;
  entityId: string;
}

/** Two-digit zero padded. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local `YYYY-MM-DD` for a date input. */
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local `HH:mm` for a time input. */
function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Reusable edit dialog for a task's full form (title, assignee, due date and
 * time). Self-contained: it owns the update mutation so every place that lists
 * tasks can drop it in with just the task + its entity.
 */
export function EditTaskDialog({ open, onOpenChange, task, entityType, entityId }: EditTaskDialogProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateTask(entityType, entityId);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [assignedToId, setAssignedToId] = useState("");
  const [completed, setCompleted] = useState(false);

  // Hydrate the form whenever a new task is opened for editing.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setAssignedToId(task.userId ?? "");
    setCompleted(!!task.completed);
    if (task.dueDate) {
      const d = new Date(task.dueDate);
      if (!isNaN(d.getTime())) {
        setDueDate(toDateInput(d));
        setDueTime(toTimeInput(d));
        return;
      }
    }
    setDueDate("");
    setDueTime("09:00");
  }, [task]);

  const handleSave = () => {
    if (!task || !title.trim() || !dueDate) return;
    const combined = new Date(`${dueDate}T${dueTime || "09:00"}`);
    updateMutation.mutate(
      {
        id: task.id,
        data: {
          title: title.trim(),
          dueDate: combined,
          completed,
          ...(assignedToId ? { userId: assignedToId } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Task updated" });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[500] max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-edit-task">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Edit Task</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            Update the task's details, due date and time.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Task</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a task…"
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid="input-edit-task-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Assign To</Label>
            <UserReassignSelect
              value={assignedToId}
              onValueChange={setAssignedToId}
              data-testid="select-edit-task-assign-to"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Status</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompleted(false)}
                className={`h-9 rounded-xl border text-xs font-semibold transition ${
                  !completed
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                    : "border-black/10 bg-white/70 text-black/55 hover:bg-black/[0.03]"
                }`}
                data-testid="button-edit-task-status-pending"
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setCompleted(true)}
                className={`h-9 rounded-xl border text-xs font-semibold transition ${
                  completed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                    : "border-black/10 bg-white/70 text-black/55 hover:bg-black/[0.03]"
                }`}
                data-testid="button-edit-task-status-done"
              >
                Done
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Due Date</Label>
              <DatePicker
                value={dueDate}
                onChange={(v) => setDueDate(v)}
                placeholder="Pick a date"
                data-testid="input-edit-task-due-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Due Time</Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-edit-task-due-time"
              />
            </div>
          </div>

          <Button
            className="h-9 w-full rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
            data-testid="button-confirm-edit-task"
            onClick={handleSave}
            disabled={!title.trim() || !dueDate || updateMutation.isPending}
          >
            {updateMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
