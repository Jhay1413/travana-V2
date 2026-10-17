export interface TaskDueInput {
  dueDate?: Date | string | null;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number) => String(n).padStart(2, "0");

/** "Due Thu 16 Oct · 10:00" (time omitted at midnight); "Overdue …" when past; "No due date" when unset. */
export function taskDueLabel(task: TaskDueInput, now: Date): string {
  if (!task.dueDate) return "No due date";
  const d = new Date(task.dueDate);
  if (isNaN(d.getTime())) return "No due date";
  const day = `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  const prefix = d.getTime() < now.getTime() ? "Overdue" : "Due";
  return `${prefix} ${day}${hasTime ? ` · ${pad(d.getHours())}:${pad(d.getMinutes())}` : ""}`;
}
