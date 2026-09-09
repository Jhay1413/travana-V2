import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  DrawerField,
  FormDrawer,
  FormDrawerFooter,
  FormDrawerSection,
  drawerControlClass,
  drawerInputClass,
} from "@/components/shared/form-drawer";
import type { FormPresentation } from "@/features/quote/types";

interface TaskForm {
  title: string;
  dueDate: string;
  dueTime: string;
}

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskForm: TaskForm;
  setTaskForm: (updater: (prev: TaskForm) => TaskForm) => void;
  isPending: boolean;
  onConfirm: () => void;
  /** "drawer" renders the right-hand Create / Edit drawer used on the client dashboard. */
  presentation?: FormPresentation;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  taskForm,
  setTaskForm,
  isPending,
  onConfirm,
  presentation = "dialog",
}: CreateTaskDialogProps) {
  const canSubmit = !!taskForm.title.trim() && !!taskForm.dueDate;

  if (presentation === "drawer") {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Create Task"
        description="Set a task with a due date and time."
        data-testid="create-task-drawer"
      >
        <div className="px-7 pb-6 pt-6">
          <DrawerField label="Task" className="max-w-[420px]">
            <Input
              id="task-title"
              placeholder="What needs to be done?"
              value={taskForm.title}
              onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
              className={drawerInputClass}
              data-testid="input-task-title"
            />
          </DrawerField>
        </div>
        <FormDrawerSection title="Schedule" data-testid="drawer-section-task-schedule">
          <div className="flex flex-wrap gap-x-6 gap-y-4">
            <DrawerField label="Due Date" className="w-[170px]">
              <DatePicker
                id="task-due-date"
                value={taskForm.dueDate}
                onChange={(dueDate) => setTaskForm((f) => ({ ...f, dueDate }))}
                className={drawerControlClass}
              />
            </DrawerField>
            <DrawerField label="Due Time" className="w-[140px]">
              <Input
                id="task-due-time"
                type="time"
                value={taskForm.dueTime}
                onChange={(e) => setTaskForm((f) => ({ ...f, dueTime: e.target.value }))}
                className={drawerInputClass}
              />
            </DrawerField>
          </div>
        </FormDrawerSection>
        <FormDrawerFooter
          submitLabel="Create Task"
          isLoading={isPending}
          disabled={!canSubmit}
          hint={canSubmit ? undefined : "Enter a task and a due date to save."}
          onSubmit={onConfirm}
          data-testid="drawer-footer"
        />
      </FormDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[500] max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">
              Task <span className="text-red-500">*</span>
            </Label>
            <Input
              id="task-title"
              placeholder="What needs to be done?"
              value={taskForm.title}
              onChange={(e) => setTaskForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="task-due-date">
                Due Date <span className="text-red-500">*</span>
              </Label>
              <DatePicker
                id="task-due-date"
                value={taskForm.dueDate}
                onChange={(dueDate) => setTaskForm((f) => ({ ...f, dueDate }))}
                className="h-9 rounded-2xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-due-time">Due Time</Label>
              <Input
                id="task-due-time"
                type="time"
                value={taskForm.dueTime}
                onChange={(e) => setTaskForm((f) => ({ ...f, dueTime: e.target.value }))}
                className="rounded-2xl"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-2xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
            disabled={!canSubmit || isPending}
            onClick={onConfirm}
          >
            {isPending ? "Creating…" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
