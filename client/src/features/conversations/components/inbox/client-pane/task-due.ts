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

/** ISO string for the NextTaskRow, or null when there is no usable due date. */
export function dueDateIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

const dueTime = (v: Date | string | null | undefined): number => {
  if (!v) return Infinity;
  const t = new Date(v).getTime();
  return isNaN(t) ? Infinity : t;
};

/** Soonest due first; tasks without a (valid) due date go last. Does not mutate. */
export function sortByDue<T extends TaskDueInput>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const x = dueTime(a.dueDate);
    const y = dueTime(b.dueDate);
    return x === y ? 0 : x < y ? -1 : 1;
  });
}
