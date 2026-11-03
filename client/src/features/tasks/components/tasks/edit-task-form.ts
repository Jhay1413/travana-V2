import type { TaskPriority } from "@/features/tasks/lib/task-priority";

export const EDIT_DEFAULT_TIME = "09:00";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local `YYYY-MM-DD` for a date input. */
export function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local `HH:mm` for a time input. */
export function toTimeInput(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Split a stored due date into date/time inputs; blank date and the default time when missing or invalid. */
export function splitDueDate(value: Date | string | null | undefined): { date: string; time: string } {
  if (value) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return { date: toDateInput(d), time: toTimeInput(d) };
  }
  return { date: "", time: EDIT_DEFAULT_TIME };
}

export interface EditTaskPayloadInput {
  title: string;
  priority: TaskPriority;
  description: string;
  dueDate: string;
  dueTime: string;
  completed: boolean;
  assignedToId: string;
}

/** Body for the update mutation: trimmed description (null when blank), combined due instant, assignee only when set. */
export function buildEditTaskPayload(input: EditTaskPayloadInput) {
  const description = input.description.trim();
  return {
    title: input.title,
    priority: input.priority,
    description: description ? description : null,
    dueDate: new Date(`${input.dueDate}T${input.dueTime || EDIT_DEFAULT_TIME}`),
    completed: input.completed,
    ...(input.assignedToId ? { userId: input.assignedToId } : {}),
  };
}
