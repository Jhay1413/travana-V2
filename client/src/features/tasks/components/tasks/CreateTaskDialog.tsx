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
import { useCreateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected assignee, e.g. the agent whose dashboard this is. */
  defaultAssignedToId?: string;
}

/** Two-digit zero padded. */
function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local `YYYY-MM-DD` for a date input. */
function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Create a standalone task and allocate it to an agent. Unlike a task created
 * from a quote/booking/enquiry, this one carries no entity link, so it lives
 * purely on the assignee's "What's on" list and opens for editing (rather than
 * navigating) when clicked.
 */
export function CreateTaskDialog({ open, onOpenChange, defaultAssignedToId }: CreateTaskDialogProps) {
  const { toast } = useToast();
  // No entity to scope invalidation to — the list/byUser caches are refreshed.
  const createMutation = useCreateTask("", "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [assignedToId, setAssignedToId] = useState("");

  // Reset the form each time the dialog is opened, defaulting today + assignee.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDueDate(toDateInput(new Date()));
    setDueTime("09:00");
    setAssignedToId(defaultAssignedToId ?? "");
  }, [open, defaultAssignedToId]);

  const handleSave = () => {
    if (!title.trim() || !dueDate || !assignedToId) return;
    const combined = new Date(`${dueDate}T${dueTime || "09:00"}`);
    createMutation.mutate(
      {
        title: title.trim(),
        dueDate: combined,
        userId: assignedToId,
        completed: false,
        notified: false,
      },
      {
        onSuccess: () => {
          toast({ title: "Task created" });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[500] max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-create-task">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">New Task</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            Create a task and allocate it to an agent.
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
              data-testid="input-create-task-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Assign To</Label>
            <UserReassignSelect
              value={assignedToId}
              onValueChange={setAssignedToId}
              data-testid="select-create-task-assign-to"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Due Date</Label>
              <DatePicker
                value={dueDate}
                onChange={(v) => setDueDate(v)}
                placeholder="Pick a date"
                data-testid="input-create-task-due-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Due Time</Label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-create-task-due-time"
              />
            </div>
          </div>

          <Button
            className="h-9 w-full rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
            data-testid="button-confirm-create-task"
            onClick={handleSave}
            disabled={!title.trim() || !dueDate || !assignedToId || createMutation.isPending}
          >
            {createMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
