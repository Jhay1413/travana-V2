import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  taskForm,
  setTaskForm,
  isPending,
  onConfirm,
}: CreateTaskDialogProps) {
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
              <Input
                id="task-due-date"
                type="date"
                value={taskForm.dueDate}
                onChange={(e) => setTaskForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="rounded-2xl"
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
            disabled={!taskForm.title.trim() || !taskForm.dueDate || isPending}
            onClick={onConfirm}
          >
            {isPending ? "Creating…" : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
