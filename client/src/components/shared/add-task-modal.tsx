import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { useCreateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { FOLLOW_UP_DUE_TIME, fillEmptyAssignee, isOpening, londonDueDate, tomorrowLondonKey } from "@/features/tasks/lib/task-defaults";
import { CUSTOM_TASK_TYPE, titleForTaskType, type TaskTypeValue } from "@/features/tasks/lib/task-types";
import { DEFAULT_TASK_PRIORITY, type TaskPriority } from "@/features/tasks/lib/task-priority";
import { TaskTypeSelect } from "@/features/tasks/components/shared/task-type-select";
import { TaskPrioritySelect } from "@/features/tasks/components/shared/task-priority-select";

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
  entityType?: string;
  entityId?: string;
  /** Pre-selected assignee (the current user or the deal owner); the agent can be changed in the form. */
  defaultAssignedToId: string | undefined;
  successToast?: string;
  onCreated?: () => void;
  testIdPrefix?: string;
}

const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted";
const FIELD_CLASS =
  "h-11 rounded-[10px] border-social-border bg-background px-3.5 text-[14px] shadow-none focus-visible:border-social-orange focus-visible:ring-[3px] focus-visible:ring-social-orange/20";

/** Add-task pop-up matching the prototype: what / assignee / date / time, pre-assigned to the caller-supplied user. */
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
        ...(entityType && entityId ? { entityType, entityId } : {}),
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[600] bg-[rgba(31,41,55,.5)]"
        className="z-[600] block w-[520px] max-w-[calc(100vw-32px)] rounded-[20px] border-social-border bg-background p-7 shadow-2xl sm:rounded-[20px]"
        data-testid={`${testIdPrefix}-modal`}
      >
        <div className="pr-8">
          <DialogTitle className="text-[20px] font-semibold leading-tight tracking-normal">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-social-muted">{subtitle}</DialogDescription>
        </div>

        <form
          className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="col-span-2 space-y-1.5">
            <label htmlFor={`${testIdPrefix}-type`} className={LABEL_CLASS}>
              What needs doing?
            </label>
            <TaskTypeSelect
              id={`${testIdPrefix}-type`}
              value={taskType}
              onChange={(v) => {
                setTaskType(v);
                setShowError(false);
              }}
              zClassName="z-[650]"
              className="h-11 rounded-[10px] border-social-border bg-background px-3.5 text-[14px] shadow-none"
              data-testid={`${testIdPrefix}-type`}
            />
            {!taskType && (
              <p className="text-xs text-red-600" data-testid={`${testIdPrefix}-type-error`}>
                Choose what needs doing.
              </p>
            )}
          </div>
          {taskType === CUSTOM_TASK_TYPE && (
            <div className="col-span-2 space-y-1.5">
              <label htmlFor={`${testIdPrefix}-custom-title`} className={LABEL_CLASS}>
                Describe the task
              </label>
              <Input
                id={`${testIdPrefix}-custom-title`}
                autoFocus
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setShowError(false);
                }}
                placeholder={placeholder}
                className={FIELD_CLASS}
                data-testid={`${testIdPrefix}-custom-title`}
              />
              {showError && !text.trim() && (
                <p className="text-xs text-red-600" data-testid={`${testIdPrefix}-error`}>
                  Enter what needs doing.
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor={`${testIdPrefix}-assignee`} className={LABEL_CLASS}>
              Assign to
            </label>
            <UserReassignSelect
              value={assignedToId}
              onValueChange={setAssignedToId}
              zClassName="z-[650]"
              className="h-11 rounded-[10px] bg-background px-3.5 text-[14px] font-medium"
              data-testid={`${testIdPrefix}-assignee`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${testIdPrefix}-priority`} className={LABEL_CLASS}>
              Priority
            </label>
            <TaskPrioritySelect
              id={`${testIdPrefix}-priority`}
              value={priority}
              onChange={setPriority}
              zClassName="z-[650]"
              className="h-11 rounded-[10px] border-social-border bg-background px-3.5 text-[14px] shadow-none"
              data-testid={`${testIdPrefix}-priority`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${testIdPrefix}-date`} className={LABEL_CLASS}>
              Date
            </label>
            <Input
              id={`${testIdPrefix}-date`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={FIELD_CLASS}
              data-testid={`${testIdPrefix}-date`}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`${testIdPrefix}-time`} className={LABEL_CLASS}>
              Time
            </label>
            <Input
              id={`${testIdPrefix}-time`}
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className={FIELD_CLASS}
              data-testid={`${testIdPrefix}-time`}
            />
          </div>

          {assigneeMissing && (
            <p className="col-span-2 text-xs text-red-600" data-testid={`${testIdPrefix}-no-assignee`}>
              Choose who this task is for.
            </p>
          )}

          <div className="col-span-2 mt-2 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-[10px] px-5 text-[14px] font-semibold"
              onClick={() => onOpenChange(false)}
              data-testid={`${testIdPrefix}-cancel`}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-[10px] bg-social-orange px-5 text-[14px] font-semibold text-slate-900 hover:bg-social-orange/90"
              disabled={saving || assigneeMissing || taskMissing}
              data-testid={`${testIdPrefix}-submit`}
            >
              {saving ? <Spinner className="h-3.5 w-3.5" /> : "Add task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
