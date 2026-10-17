// Presentation rules for the client page's Tasks and Views tabs. Pure, with an
// injectable "now", so they are unit-tested.

export interface DueChip {
  label: string;
  /** Token-based classes (status-* palette). */
  className: string;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function taskDueChip(due: Date, now: Date = new Date()): DueChip {
  const dayDiff = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
  if (dayDiff < 0) return { label: "Overdue", className: "bg-status-failed-bg text-status-failed-fg" };
  if (dayDiff === 0) return { label: "Today", className: "bg-status-scheduled-bg text-status-scheduled-fg" };
  if (dayDiff === 1) return { label: "Tomorrow", className: "bg-status-posted-bg text-status-posted-fg" };
  return {
    label: due.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    className: "bg-status-draft-bg text-status-draft-fg",
  };
}

interface SortableTask {
  completed: boolean | null;
  dueDate: string | Date | null;
}

function dueTime(task: SortableTask): number {
  if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
  const t = new Date(task.dueDate).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/** Open tasks first, soonest due first; undated tasks sink to the end of their group. */
export function sortTasks<T extends SortableTask>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => Number(!!a.completed) - Number(!!b.completed) || dueTime(a) - dueTime(b));
}

export function longDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return longDate(iso) ?? "";
}

/** Total views across the client's quotes, for the Views tab badge. */
export function totalViews(views: Array<{ viewCount: number }> | undefined): number {
  return (views ?? []).reduce((sum, v) => sum + v.viewCount, 0);
}
