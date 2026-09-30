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
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import {
  DrawerField,
  FormDrawer,
  FormDrawerFooter,
  FormDrawerSection,
  drawerControlClass,
  drawerInputClass,
} from "@/components/shared/form-drawer";
import { cn } from "@/lib/utils";
import type { FormPresentation } from "@/features/quote/types";
import { useUpdateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

export interface EditableTask {
  id: string;
  title: string | null;
  description?: string | null;
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
  /** "drawer" renders the right-hand drawer used across the app; defaults to a centered dialog. */
  presentation?: FormPresentation;
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
export function EditTaskDialog({ open, onOpenChange, task, entityType, entityId, presentation = "dialog" }: EditTaskDialogProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateTask(entityType, entityId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [assignedToId, setAssignedToId] = useState("");
  const [completed, setCompleted] = useState(false);

  // Hydrate the form whenever a new task is opened for editing.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title ?? "");
    setDescription(task.description ?? "");
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
          description: description.trim() ? description.trim() : null,
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

  const canSubmit = !!title.trim() && !!dueDate;

  if (presentation === "drawer") {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Edit Task"
        description="Update the task's details, due date and time."
        data-testid="edit-task-drawer"
      >
        <div className="px-7 pb-6 pt-6 grid gap-4" data-testid="dialog-edit-task">
          <DrawerField label="Task" className="max-w-[420px]">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a task…"
              className={drawerInputClass}
              data-testid="input-edit-task-title"
            />
          </DrawerField>
          <DrawerField label="Description" className="max-w-[560px]">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail (optional)…"
              className="min-h-[88px] rounded-md border border-black/[0.08] bg-[#f4f5f7] px-3 py-2 text-sm text-black/80 shadow-none placeholder:text-black/35 focus-visible:ring-1 focus-visible:ring-[#26cfb3]"
              data-testid="input-edit-task-description"
            />
          </DrawerField>
          <DrawerField label="Assign To" className="max-w-[420px]">
            <UserReassignSelect
              value={assignedToId}
              onValueChange={setAssignedToId}
              className={drawerControlClass}
              data-testid="select-edit-task-assign-to"
            />
          </DrawerField>
          <DrawerField label="Status" className="max-w-[420px]">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCompleted(false)}
                className={cn(
                  "h-11 rounded-md border text-sm font-medium transition",
                  !completed
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    : "border-black/[0.08] bg-[#f4f5f7] text-black/55 hover:bg-[#eef0f3] dark:border-white/10 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/10",
                )}
                data-testid="button-edit-task-status-pending"
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => setCompleted(true)}
                className={cn(
                  "h-11 rounded-md border text-sm font-medium transition",
                  completed
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-black/[0.08] bg-[#f4f5f7] text-black/55 hover:bg-[#eef0f3] dark:border-white/10 dark:bg-white/5 dark:text-white/55 dark:hover:bg-white/10",
                )}
                data-testid="button-edit-task-status-done"
              >
                Done
              </button>
            </div>
          </DrawerField>
        </div>
        <FormDrawerSection title="Schedule" data-testid="drawer-section-edit-task-schedule">
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <DrawerField label="Due Date" className="w-[170px]">
              <DatePicker
                value={dueDate}
                onChange={(v) => setDueDate(v)}
                placeholder="Pick a date"
                className={drawerControlClass}
                modal
                data-testid="input-edit-task-due-date"
              />
            </DrawerField>
            <DrawerField label="Due Time" className="w-[140px]">
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className={drawerInputClass}
                data-testid="input-edit-task-due-time"
              />
            </DrawerField>
          </div>
        </FormDrawerSection>
        <FormDrawerFooter
          submitLabel="Save Changes"
          isLoading={updateMutation.isPending}
          disabled={!canSubmit}
          hint={canSubmit ? undefined : "Enter a task and due date to save."}
          onSubmit={handleSave}
          data-testid="button-confirm-edit-task"
        />
      </FormDrawer>
    );
  }

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
            <Label className="text-xs font-medium text-black/60">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail (optional)…"
              className="min-h-[72px] rounded-xl border-black/10 bg-white/70"
              data-testid="input-edit-task-description"
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
