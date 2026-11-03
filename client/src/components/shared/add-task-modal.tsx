import { useEffect, useRef, useState } from "react";
import { TaskModalShell } from "@/components/shared/task-modal/task-modal-shell";
import {
  TaskAssigneeField,
  TaskCustomTitleField,
  TaskDateField,
  TaskPriorityField,
  TaskTimeField,
  TaskTypeField,
} from "@/components/shared/task-modal/task-form-fields";
import { TaskLinkFields } from "@/components/shared/task-modal/task-link-fields";
import { linkedTaskEntity, type NeonClient, type TaskDealOption } from "@/features/client";
import { useCreateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { FOLLOW_UP_DUE_TIME, fillEmptyAssignee, isOpening, londonDueDate, tomorrowLondonKey } from "@/features/tasks/lib/task-defaults";
import { CUSTOM_TASK_TYPE, titleForTaskType, type TaskTypeValue } from "@/features/tasks/lib/task-types";
import { DEFAULT_TASK_PRIORITY, type TaskPriority } from "@/features/tasks/lib/task-priority";

interface AddTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  /** Placeholder for the Custom text field. */
  placeholder?: string;
  /** Pre-filled due date, YYYY-MM-DD (London). Defaults to tomorrow. */
  defaultDueDate?: string;
  /** Pre-filled due time, HH:mm. Defaults to 10:00. */
  defaultDueTime?: string;
  /** The entity the task belongs to. When omitted, the form offers an optional client and deal to link instead. */
  entityType?: string;
  entityId?: string;
  /** Pre-selected assignee (the current user or the deal owner); the agent can be changed in the form. */
  defaultAssignedToId: string | undefined;
  successToast?: string;
  onCreated?: () => void;
  testIdPrefix?: string;
}

/**
 * Add-task pop-up matching the prototype: what / assignee / date / time, pre-assigned to the caller-supplied user.
 * Without a caller-supplied entity it also offers an optional client and one of that client's live deals to attach to.
 */
export function AddTaskModal({
  open,
  onOpenChange,
  title = "Add task",
  subtitle,
  placeholder = "Call to go through the quote",
  defaultDueDate,
  defaultDueTime,
  entityType,
  entityId,
  defaultAssignedToId,
  successToast = "Task added",
  onCreated,
  testIdPrefix = "add-task",
}: AddTaskModalProps) {
  const { toast } = useToast();
  const createMutation = useCreateTask(entityType ?? "", entityId ?? "");
  const [taskType, setTaskType] = useState<TaskTypeValue | "">("");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<TaskPriority>(DEFAULT_TASK_PRIORITY);
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState(FOLLOW_UP_DUE_TIME);
  const [assignedToId, setAssignedToId] = useState("");
  const [showError, setShowError] = useState(false);
  const [linkClient, setLinkClient] = useState<NeonClient | null>(null);
  const [linkDeal, setLinkDeal] = useState<TaskDealOption | null>(null);
  const hasEntity = !!entityType && !!entityId;

  // Reset the form on the closed -> open flip only.
  const prevOpen = useRef(false);
  useEffect(() => {
    const opening = isOpening(prevOpen.current, open);
    prevOpen.current = open;
    if (!opening) return;
    setTaskType("");
    setText("");
    setPriority(DEFAULT_TASK_PRIORITY);
    setShowError(false);
    setDueDate(defaultDueDate || tomorrowLondonKey());
    setDueTime(defaultDueTime || FOLLOW_UP_DUE_TIME);
    setAssignedToId(defaultAssignedToId ?? "");
    setLinkClient(null);
    setLinkDeal(null);
  }, [open]);

  // A default assignee that arrives after opening fills an empty slot but never overwrites a choice.
  useEffect(() => {
    if (open) setAssignedToId((cur) => fillEmptyAssignee(cur, defaultAssignedToId));
  }, [open, defaultAssignedToId]);

  const assigneeMissing = !assignedToId;
  const saving = createMutation.isPending;
  const taskMissing = !taskType || (taskType === CUSTOM_TASK_TYPE && !text.trim());

  const handleSave = () => {
    if (saving || !assignedToId) return;
    const due = londonDueDate(dueDate, dueTime || FOLLOW_UP_DUE_TIME);
    const taskTitle = taskType ? titleForTaskType(taskType, text) : "";
    if (!taskType || !taskTitle || !due) {
      setShowError(true);
      return;
    }
    createMutation.mutate(
      {
        title: taskTitle,
        priority,
        description: null,
        dueDate: due,
        userId: assignedToId,
        completed: false,
        notified: false,
        ...linkedTaskEntity({ entityType, entityId, deal: linkDeal, clientId: linkClient?.id ?? null }),
      },
      {
        onSuccess: () => {
          toast({ title: successToast });
          onCreated?.();
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
      },
    );
  };

  const p = testIdPrefix;
  return (
    <TaskModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      subtitle={subtitle}
      onSubmit={handleSave}
      submitLabel="Add task"
      saving={saving}
      submitDisabled={assigneeMissing || taskMissing}
      contentTestId={`${p}-modal`}
      cancelTestId={`${p}-cancel`}
      submitTestId={`${p}-submit`}
    >
      <TaskTypeField
        id={`${p}-type`}
        testId={`${p}-type`}
        value={taskType}
        onChange={(v) => {
          setTaskType(v);
          setShowError(false);
        }}
        errorTestId={`${p}-type-error`}
      />
      <TaskCustomTitleField
        id={`${p}-custom-title`}
        testId={`${p}-custom-title`}
        taskType={taskType}
        value={text}
        onChange={(v) => {
          setText(v);
          setShowError(false);
        }}
        placeholder={placeholder}
        autoFocus
        error={{ show: showError, testId: `${p}-error` }}
      />
      {!hasEntity && <TaskLinkFields client={linkClient} onClientChange={setLinkClient} deal={linkDeal} onDealChange={setLinkDeal} testIdPrefix={p} />}
      <TaskAssigneeField id={`${p}-assignee`} testId={`${p}-assignee`} value={assignedToId} onChange={setAssignedToId} />
      <TaskPriorityField id={`${p}-priority`} testId={`${p}-priority`} value={priority} onChange={setPriority} />
      <TaskDateField id={`${p}-date`} testId={`${p}-date`} value={dueDate} onChange={setDueDate} />
      <TaskTimeField id={`${p}-time`} testId={`${p}-time`} value={dueTime} onChange={setDueTime} />

      {assigneeMissing && (
        <p className="col-span-2 text-xs text-red-600" data-testid={`${p}-no-assignee`}>
          Choose who this task is for.
        </p>
      )}
    </TaskModalShell>
  );
}
