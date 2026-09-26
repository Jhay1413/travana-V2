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
import { useCreateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import type { FormPresentation } from "@/features/quote/types";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected assignee, e.g. the agent whose dashboard this is, or the current user. */
  defaultAssignedToId?: string;
  /** Attaches the task to a quote/booking/enquiry/client record instead of creating a standalone one. */
  entityType?: string;
  entityId?: string;
  /** "drawer" renders the right-hand Create drawer used across the app; defaults to a centered dialog. */
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

/**
 * The single Create Task entry point used everywhere in the app — standalone
 * (agent dashboards) or attached to an entity (client/quote/booking/enquiry).
 * When `entityType`/`entityId` are supplied the task is linked to that record;
 * otherwise it's a standalone task that lives purely on the assignee's
 * "What's on" list.
 */
export function CreateTaskDialog({
  open,
  onOpenChange,
  defaultAssignedToId,
  entityType,
  entityId,
  presentation = "dialog",
}: CreateTaskDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateTask(entityType ?? "", entityId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [assignedToId, setAssignedToId] = useState("");

  // Reset the form each time the dialog is opened, defaulting today + assignee.
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setDueDate(toDateInput(new Date()));
    setDueTime("09:00");
    setAssignedToId(defaultAssignedToId ?? "");
  }, [open, defaultAssignedToId]);

  const canSubmit = !!title.trim() && !!dueDate && !!assignedToId;

  const handleSave = () => {
    if (!canSubmit) return;
    const combined = new Date(`${dueDate}T${dueTime || "09:00"}`);
    createMutation.mutate(
      {
        title: title.trim(),
        description: description.trim() ? description.trim() : null,
        dueDate: combined,
        userId: assignedToId,
        completed: false,
        notified: false,
        ...(entityType && entityId ? { entityType, entityId } : {}),
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

  if (presentation === "drawer") {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Create Task"
        description="Create a task and allocate it to an agent."
        data-testid="create-task-drawer"
      >
        <div className="px-7 pb-6 pt-6 grid gap-4">
          <DrawerField label="Task" className="max-w-[420px]">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className={drawerInputClass}
              data-testid="input-create-task-title"
            />
          </DrawerField>
          <DrawerField label="Description" className="max-w-[560px]">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail (optional)…"
              className="min-h-[88px] rounded-md border border-black/[0.08] bg-[#f4f5f7] px-3 py-2 text-sm text-black/80 shadow-none placeholder:text-black/35 focus-visible:ring-1 focus-visible:ring-[#26cfb3]"
              data-testid="input-create-task-description"
            />
          </DrawerField>
          <DrawerField label="Assign To" className="max-w-[420px]">
            <UserReassignSelect
              value={assignedToId}
              onValueChange={setAssignedToId}
              className={drawerControlClass}
              data-testid="select-create-task-assign-to"
            />
          </DrawerField>
        </div>
        <FormDrawerSection title="Schedule" data-testid="drawer-section-task-schedule">
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <DrawerField label="Due Date" className="w-[170px]">
              <DatePicker
                value={dueDate}
                onChange={(v) => setDueDate(v)}
                placeholder="Pick a date"
                className={drawerControlClass}
                modal
                data-testid="input-create-task-due-date"
              />
            </DrawerField>
            <DrawerField label="Due Time" className="w-[140px]">
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className={drawerInputClass}
                data-testid="input-create-task-due-time"
              />
            </DrawerField>
          </div>
        </FormDrawerSection>
        <FormDrawerFooter
          submitLabel="Create Task"
          isLoading={createMutation.isPending}
          disabled={!canSubmit}
          hint={canSubmit ? undefined : "Enter a task, assignee and due date to save."}
          onSubmit={handleSave}
          data-testid="drawer-footer"
        />
      </FormDrawer>
    );
  }

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
            <Label className="text-xs font-medium text-black/60">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail (optional)…"
              className="min-h-[72px] rounded-xl border-black/10 bg-white/70"
              data-testid="input-create-task-description"
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
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
