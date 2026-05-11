import { useState } from "react";
import { useCreateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

const EMPTY_TASK_FORM = { title: "", dueDate: "", dueTime: "09:00" };

/**
 * Owns the Create Task dialog: open state, form fields, and confirm action
 * which mutates the task and resets state.
 */
export function useClientTaskCreate(clientId: string, currentUserId: string | undefined) {
  const { toast } = useToast();
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const createTaskMutation = useCreateTask("client", clientId || "");

  function confirmCreateTask() {
    if (!taskForm.title.trim() || !taskForm.dueDate || !currentUserId) return;
    const dueDate = new Date(`${taskForm.dueDate}T${taskForm.dueTime || "09:00"}`);
    createTaskMutation.mutate(
      {
        entityType: "client",
        entityId: clientId,
        userId: currentUserId,
        title: taskForm.title.trim(),
        dueDate: dueDate,
        completed: false,
        notified: false,
      },
      {
        onSuccess: () => {
          toast({ title: "Task created" });
          setShowTaskDialog(false);
          setTaskForm(EMPTY_TASK_FORM);
        },
        onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
      },
    );
  }

  return {
    showTaskDialog,
    setShowTaskDialog,
    taskForm,
    setTaskForm,
    createTaskMutation,
    confirmCreateTask,
  };
}
