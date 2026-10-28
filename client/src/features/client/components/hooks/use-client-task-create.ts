import { useState } from "react";

/**
 * Owns the add-task modal's open state. The form itself (task type,
 * priority, assignee, due date/time) lives in the shared `AddTaskModal`
 * (`@/components/shared/add-task-modal`), which owns its own mutation.
 */
export function useClientTaskCreate() {
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  return { showTaskDialog, setShowTaskDialog };
}
