import { useState } from "react";

/**
 * Owns the Create Task drawer's open state. The form itself (title,
 * description, assignee, due date/time) lives in the shared
 * `CreateTaskDialog` component from `@/features/tasks`, which is
 * self-contained and owns its own mutation.
 */
export function useClientTaskCreate() {
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  return { showTaskDialog, setShowTaskDialog };
}
