import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
import { fillEmptyAssignee, isOpening, resolveTaskFormDefaults } from "@/features/tasks/lib/task-defaults";
import { CUSTOM_TASK_TYPE, titleForTaskType, type TaskTypeValue } from "@/features/tasks/lib/task-types";
import { DEFAULT_TASK_PRIORITY, type TaskPriority } from "@/features/tasks/lib/task-priority";
import { TaskTypeSelect } from "../shared/task-type-select";
import { TaskPrioritySelect } from "../shared/task-priority-select";

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
  /** Dialog heading (default "New Task"). */
  title?: string;
  /** Dialog sub-heading. */
  description?: string;
  /** Submit button label (default "Create Task"). */
  submitLabel?: string;
  /** Pre-filled due date, YYYY-MM-DD (default today). */
  defaultDueDate?: string;
  /** Pre-filled due time, HH:mm (default 09:00). */
  defaultDueTime?: string;
  hideDescription?: boolean;
  /** Hides the assignee picker; the task goes to defaultAssignedToId. */
  hideAssignee?: boolean;
  /** "above-drawer" lifts the dialog and its overlay over a side drawer (z-[600]). */
  layer?: "above-drawer";
  /** Called after the task is created, before the dialog closes. */
  onCreated?: () => void;
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
  title: heading = "New Task",
  description: subheading = "Create a task and allocate it to an agent.",
  submitLabel = "Create Task",
  defaultDueDate,
  defaultDueTime,
  hideDescription = false,
  hideAssignee = false,
  layer,
  onCreated,
}: CreateTaskDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateTask(entityType ?? "", entityId ?? "");
  const [taskType, setTaskType] = useState<TaskTypeValue | "">("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(DEFAULT_TASK_PRIORITY);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [assignedToId, setAssignedToId] = useState("");

  // Reset the form each time the dialog is opened, defaulting today + assignee.
  const prevOpen = useRef(false);
  useEffect(() => {
    const opening = isOpening(prevOpen.current, open);
    prevOpen.current = open;
    if (!opening) return;
    setTaskType("");
    setTitle("");
    setPriority(DEFAULT_TASK_PRIORITY);
    setDescription("");
    const initial = resolveTaskFormDefaults({ defaultDueDate, defaultDueTime, defaultAssignedToId }, toDateInput(new Date()));
    setDueDate(initial.dueDate);
    setDueTime(initial.dueTime);
    setAssignedToId(initial.assignedToId);
  }, [open]);

  // A default assignee that arrives after opening fills an empty slot without touching other fields.
  useEffect(() => {
    if (open) setAssignedToId((cur) => fillEmptyAssignee(cur, defaultAssignedToId));
  }, [open, defaultAssignedToId]);

  const assigneeMissing = hideAssignee && !assignedToId;
  const assigneeNote = assigneeMissing ? (
    <p className="text-xs text-red-600" data-testid="text-create-task-no-assignee">
      Couldn't work out who to assign this to. Reload and try again.
    </p>
  ) : null;

  const taskTitle = taskType ? titleForTaskType(taskType, title) : "";
  const canSubmit = !!taskType && !!taskTitle && !!dueDate && !!assignedToId;

  const handleSave = () => {
    if (!canSubmit) return;
    const combined = new Date(`${dueDate}T${dueTime || "09:00"}`);
    createMutation.mutate(
      {
        title: taskTitle,
        priority,
        description: description.trim() ? description.trim() : null,
        dueDate: combined,
        userId: assignedToId,
        completed: false,
        notified: false,
        ...(entityType && entityId ? { entityType, entityId } : {}),
      },
      {
        onSuccess: () => {
          toast({ title: submitLabel === "Create Task" ? "Task created" : "Task added" });
          onCreated?.();
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
        title={heading === "New Task" ? "Create Task" : heading}
        description={subheading}
        data-testid="create-task-drawer"
      >
        <div className="px-7 pb-6 pt-6 grid gap-4">
          <DrawerField label="Task" className="max-w-[420px]">
            <TaskTypeSelect
              value={taskType}
              onChange={setTaskType}
              className={drawerControlClass}
              aria-label="Task type"
              data-testid="create-task-type"
            />
          </DrawerField>
          {taskType === CUSTOM_TASK_TYPE && (
            <DrawerField label="Describe the task" className="max-w-[420px]">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                className={drawerInputClass}
                data-testid="input-create-task-title"
              />
            </DrawerField>
          )}
          <DrawerField label="Priority" className="max-w-[420px]">
            <TaskPrioritySelect
              value={priority}
              onChange={setPriority}
              className={drawerControlClass}
              aria-label="Priority"
              data-testid="create-task-priority"
            />
          </DrawerField>
          {!hideDescription && <DrawerField label="Description" className="max-w-[560px]">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add more detail (optional)…"
              className="min-h-[88px] rounded-md border border-black/[0.08] bg-[#f4f5f7] px-3 py-2 text-sm text-black/80 shadow-none placeholder:text-black/35 focus-visible:ring-1 focus-visible:ring-[#26cfb3]"
              data-testid="input-create-task-description"
            />
          </DrawerField>}
          {assigneeNote}
          {!hideAssignee && <DrawerField label="Assign To" className="max-w-[420px]">
            <UserReassignSelect
              value={assignedToId}
              onValueChange={setAssignedToId}
              className={drawerControlClass}
              data-testid="select-create-task-assign-to"
            />
          </DrawerField>}
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
          submitLabel={submitLabel}
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
      <DialogContent
        overlayClassName={layer === "above-drawer" ? "z-[600]" : undefined}
        className={cn(layer === "above-drawer" ? "z-[600]" : "z-[500]", "max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl")}
        data-testid="dialog-create-task"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{heading}</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            {subheading}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Task</Label>
            <TaskTypeSelect
              value={taskType}
              onChange={setTaskType}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              aria-label="Task type"
              data-testid="create-task-type"
            />
          </div>

          {taskType === CUSTOM_TASK_TYPE && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Describe the task</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a task…"
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-create-task-title"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Priority</Label>
            <TaskPrioritySelect
              value={priority}
              onChange={setPriority}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              aria-label="Priority"
              data-testid="create-task-priority"
            />
          </div>

          {!hideDescription && (
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
          )}

          {assigneeNote}
          {!hideAssignee && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Assign To</Label>
              <UserReassignSelect
                value={assignedToId}
                onValueChange={setAssignedToId}
                zClassName={layer === "above-drawer" ? "z-[650]" : undefined}
                data-testid="select-create-task-assign-to"
              />
            </div>
          )}

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
            {createMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
