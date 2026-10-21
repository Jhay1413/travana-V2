import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useCreateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { FOLLOW_UP_DUE_TIME, isOpening, londonDueDate, tomorrowLondonKey } from "@/features/tasks/lib/task-defaults";

interface AddTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  /** Pre-filled due date, YYYY-MM-DD (London). Defaults to tomorrow. */
  defaultDueDate?: string;
  /** Pre-filled due time, HH:mm. Defaults to 10:00. */
  defaultDueTime?: string;
  entityType?: string;
  entityId?: string;
  assignedToId: string | undefined;
  successToast?: string;
  onCreated?: () => void;
  testIdPrefix?: string;
}

const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted";
const FIELD_CLASS =
  "h-11 rounded-[10px] border-social-border bg-background px-3.5 text-[14px] shadow-none focus-visible:border-social-orange focus-visible:ring-[3px] focus-visible:ring-social-orange/20";

/** Add-task pop-up matching the prototype: what / date / time, assigned to the caller-supplied user. */
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
  assignedToId,
  successToast = "Task added",
  onCreated,
  testIdPrefix = "add-task",
}: AddTaskModalProps) {
  const { toast } = useToast();
  const createMutation = useCreateTask(entityType ?? "", entityId ?? "");
  const [text, setText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState(FOLLOW_UP_DUE_TIME);
  const [showError, setShowError] = useState(false);

  // Reset the form on the closed -> open flip only.
  const prevOpen = useRef(false);
  useEffect(() => {
    const opening = isOpening(prevOpen.current, open);
    prevOpen.current = open;
    if (!opening) return;
    setText("");
    setShowError(false);
    setDueDate(defaultDueDate || tomorrowLondonKey());
    setDueTime(defaultDueTime || FOLLOW_UP_DUE_TIME);
  }, [open]);

  const assigneeMissing = !assignedToId;
  const saving = createMutation.isPending;

  const handleSave = () => {
    if (saving || !assignedToId) return;
    const due = londonDueDate(dueDate, dueTime || FOLLOW_UP_DUE_TIME);
    if (!text.trim() || !due) {
      setShowError(true);
      return;
    }
    createMutation.mutate(
      {
        title: text.trim(),
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
            <label htmlFor={`${testIdPrefix}-title`} className={LABEL_CLASS}>
              What needs doing?
            </label>
            <Input
              id={`${testIdPrefix}-title`}
              autoFocus
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setShowError(false);
              }}
              placeholder={placeholder}
              className={FIELD_CLASS}
              data-testid={`${testIdPrefix}-title`}
            />
            {showError && !text.trim() && (
              <p className="text-xs text-red-600" data-testid={`${testIdPrefix}-error`}>
                Enter what needs doing.
              </p>
            )}
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
              Couldn't work out who to assign this to. Reload and try again.
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
              disabled={saving || assigneeMissing}
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
