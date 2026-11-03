import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { TaskModalShell } from "@/components/shared/task-modal/task-modal-shell";
import {
  TASK_FIELD_CLASS,
  TaskAssigneeField,
  TaskCustomTitleField,
  TaskDateField,
  TaskFieldRow,
  TaskPriorityField,
  TaskTimeField,
  TaskTypeField,
} from "@/components/shared/task-modal/task-form-fields";
import { cn } from "@/lib/utils";
import { useUpdateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { taskTypeForTitle, titleForTaskType, type TaskTypeValue } from "@/features/tasks/lib/task-types";
import { DEFAULT_TASK_PRIORITY, type TaskPriority } from "@/features/tasks/lib/task-priority";
import { EDIT_DEFAULT_TIME, buildEditTaskPayload, splitDueDate } from "./edit-task-form";

export interface EditableTask {
  id: string;
  title: string | null;
  description?: string | null;
  dueDate: Date | string | null;
  userId: string | null;
  completed?: boolean | null;
  priority?: TaskPriority | null;
}

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: EditableTask | null;
  /** Entity the task belongs to — used to invalidate the right cached lists. */
  entityType: string;
  entityId: string;
  /** Context line under the title; defaults to a generic hint. */
  subtitle?: string;
}

const STATUS_BASE = "h-11 rounded-[10px] border text-[14px] font-semibold transition";
const STATUS_IDLE = "border-social-border bg-background text-social-muted hover:bg-muted";

/**
 * Edit-task pop-up: same centred modal and fields as Add task, plus description and
 * status. Self-contained: it owns the update mutation so every place that lists
 * tasks can drop it in with just the task + its entity.
 */
export function EditTaskDialog({
  open,
  onOpenChange,
  task,
  entityType,
  entityId,
  subtitle = "Update the task's details, due date and time.",
}: EditTaskDialogProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateTask(entityType, entityId);
  const [taskType, setTaskType] = useState<TaskTypeValue>("custom");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(DEFAULT_TASK_PRIORITY);
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState(EDIT_DEFAULT_TIME);
  const [assignedToId, setAssignedToId] = useState("");
  const [completed, setCompleted] = useState(false);

  // Hydrate the form whenever a new task is opened for editing.
  useEffect(() => {
    if (!task) return;
    setTaskType(taskTypeForTitle(task.title));
    setTitle(task.title ?? "");
    setPriority(task.priority ?? DEFAULT_TASK_PRIORITY);
    setDescription(task.description ?? "");
    setAssignedToId(task.userId ?? "");
    setCompleted(!!task.completed);
    const due = splitDueDate(task.dueDate);
    setDueDate(due.date);
    setDueTime(due.time);
  }, [task]);

  const taskTitle = titleForTaskType(taskType, title);
  const canSubmit = !!taskTitle && !!dueDate;

  const handleSave = () => {
    if (!task || !canSubmit || updateMutation.isPending) return;
    updateMutation.mutate(
      { id: task.id, data: buildEditTaskPayload({ title: taskTitle, priority, description, dueDate, dueTime, completed, assignedToId }) },
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
    <TaskModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Edit task"
      subtitle={subtitle}
      onSubmit={handleSave}
      submitLabel="Save changes"
      saving={updateMutation.isPending}
      submitDisabled={!canSubmit}
      contentTestId="dialog-edit-task"
      cancelTestId="button-cancel-edit-task"
      submitTestId="button-confirm-edit-task"
    >
      <TaskTypeField id="edit-task-type" testId="edit-task-type" value={taskType} onChange={setTaskType} />
      <TaskCustomTitleField
        id="edit-task-title"
        testId="input-edit-task-title"
        taskType={taskType}
        value={title}
        onChange={setTitle}
        placeholder="Enter a task…"
      />
      <TaskAssigneeField id="edit-task-assignee" testId="select-edit-task-assign-to" value={assignedToId} onChange={setAssignedToId} />
      <TaskPriorityField id="edit-task-priority" testId="edit-task-priority" value={priority} onChange={setPriority} />
      <TaskDateField id="edit-task-date" testId="input-edit-task-due-date" value={dueDate} onChange={setDueDate} />
      <TaskTimeField id="edit-task-time" testId="input-edit-task-due-time" value={dueTime} onChange={setDueTime} />
      <TaskFieldRow id="edit-task-description" label="Description" wide>
        <Textarea
          id="edit-task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add more detail (optional)…"
          className={cn(TASK_FIELD_CLASS, "h-auto min-h-[88px] py-2.5")}
          data-testid="input-edit-task-description"
        />
      </TaskFieldRow>
      <TaskFieldRow id="edit-task-status" label="Status" wide>
        <div className="grid grid-cols-2 gap-2" id="edit-task-status">
          <button
            type="button"
            onClick={() => setCompleted(false)}
            className={cn(STATUS_BASE, !completed ? "border-amber-500/30 bg-amber-500/10 text-amber-700" : STATUS_IDLE)}
            data-testid="button-edit-task-status-pending"
          >
            Pending
          </button>
          <button
            type="button"
            onClick={() => setCompleted(true)}
            className={cn(STATUS_BASE, completed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : STATUS_IDLE)}
            data-testid="button-edit-task-status-done"
          >
            Done
          </button>
        </div>
      </TaskFieldRow>
    </TaskModalShell>
  );
}
