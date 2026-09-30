import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, Ellipsis } from "lucide-react";
import { useUserTasks } from "@/hooks/queries";
import { useUpdateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { EditTaskDialog } from "@/features/tasks/components/tasks/EditTaskDialog";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { dealDeepLinkHref } from "@/lib/deal-links";
import { currency } from "./helpers";
import { InitialsAvatar } from "./dashboard-ui";

type TasksFilter = "all" | "today" | "tomorrow" | "this-week" | "custom" | "overdue";

const FILTER_LABELS: Record<Exclude<TasksFilter, "overdue">, string> = {
  all: "All",
  today: "Today",
  tomorrow: "Tomorrow",
  "this-week": "This Week",
  custom: "Select Date",
};

function fmtDate(d?: string | Date | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function duePill(due: string | Date | null | undefined): { label: string; className: string } {
  if (!due) return { label: "No date", className: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60" };
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  if (d.getTime() < Date.now() && d < today) return { label: "Overdue", className: "bg-red-500 text-white" };
  if (d >= today && d < tomorrow) return { label: "Today", className: "bg-emerald-500 text-white" };
  if (d >= tomorrow && d < dayAfter) return { label: "Tomorrow", className: "bg-blue-500 text-white" };
  return {
    label: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
    className: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
  };
}

export function TasksTab({ userId }: { userId: string }) {
  const [, navigate] = useLocation();
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const { toast } = useToast();
  // Tasks are not entity-scoped on this dashboard; useUpdateTask also invalidates
  // taskKeys.all, which covers every byUser list regardless of these args.
  const updateTask = useUpdateTask("", "");
  // Ids ticked off in this panel. Applied optimistically so the row reads as done
  // straight away; the incomplete-only list then drops it once it refetches.
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());
  const [filter, setFilter] = useState<TasksFilter>("today");
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    switch (filter) {
      case "all":
      case "overdue":
        // Overdue has its own dedicated query; this range is unused for it.
        return { start: new Date(0), end: new Date(2100, 0, 1) };
      case "today":
        return { start: today, end: tomorrow };
      case "tomorrow":
        return { start: tomorrow, end: endOfTomorrow };
      case "this-week":
        return { start: startOfWeek, end: endOfWeek };
      case "custom": {
        const d = new Date(customDate);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        return { start: d, end: next };
      }
    }
  }, [filter, customDate]);

  // Stable "now" so the overdue query key doesn't change on every render.
  const nowIso = useMemo(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString();
  }, []);
  const nowMs = useMemo(() => new Date(nowIso).getTime(), [nowIso]);
  const isTaskOverdue = (task: any) =>
    !task.completed && !!task.dueDate && new Date(task.dueDate).getTime() < nowMs;

  const { data: tasksData } = useUserTasks(userId, {
    dueFrom: dateRange?.start.toISOString(),
    dueTo: dateRange?.end.toISOString(),
    incomplete: true,
  });
  // Dedicated query for overdue tasks: drives both the "Overdue" list and the
  // count badge, regardless of the currently active filter.
  const { data: overdueTasksData } = useUserTasks(userId, { dueTo: nowIso, incomplete: true });

  const overdueTasks = useMemo(() => {
    if (!overdueTasksData || !Array.isArray(overdueTasksData)) return [];
    return overdueTasksData
      .filter(isTaskOverdue)
      .sort((a: any, b: any) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
  }, [overdueTasksData, nowMs]);
  const overdueCount = overdueTasks.length;

  const tasks = useMemo(() => {
    if (filter === "overdue") return overdueTasks;
    if (!tasksData || !Array.isArray(tasksData)) return [];
    return [...tasksData].sort(
      (a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime(),
    );
  }, [filter, tasksData, overdueTasks]);

  const completeTask = (id: string) => {
    setDoneIds((prev) => new Set(prev).add(id));
    updateTask.mutate(
      { id, data: { completed: true } },
      {
        onError: () => {
          setDoneIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          toast({ title: "Failed to complete task", variant: "destructive" });
        },
      },
    );
  };

  const taskHref = (task: any): string | null =>
    dealDeepLinkHref(task.entityType, task.entityId, task.clientId);

  return (
    <div className="flex min-h-[300px] flex-col" data-testid="panel-dashboard-tasks">
      <div className="flex flex-wrap items-center gap-2" data-testid="dashboard-tasks-filters">
        {(["all", "today", "tomorrow", "this-week", "custom"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
              filter === f
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "border border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10",
            )}
            data-testid={`button-tasks-filter-${f}`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setFilter("overdue")}
          className={cn(
            "relative rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
            filter === "overdue"
              ? "bg-red-600 text-white"
              : "border border-red-500/30 bg-red-500/5 text-red-700 hover:bg-red-500/10 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20",
          )}
          data-testid="button-tasks-filter-overdue"
        >
          Overdue
          {overdueCount > 0 && (
            <span
              className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-black"
              data-testid="badge-tasks-overdue-count"
            >
              {overdueCount}
            </span>
          )}
        </button>
        {filter === "custom" && (
          <DatePicker
            value={customDate}
            onChange={(v) => setCustomDate(v)}
            placeholder="Pick a date"
            className="h-7 w-auto rounded-md text-[11px]"
            data-testid="input-tasks-filter-date"
          />
        )}
      </div>

      <div className="mt-3 flex-1 space-y-1">
        {tasks.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-black/10 p-8 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45"
            data-testid="empty-dashboard-tasks"
          >
            {filter === "overdue"
              ? "No overdue tasks"
              : filter === "all"
                ? "No open tasks"
                : `No tasks due ${
                    filter === "today"
                      ? "today"
                      : filter === "tomorrow"
                        ? "tomorrow"
                        : filter === "this-week"
                          ? "this week"
                          : `on ${customDate}`
                  }`}
          </div>
        ) : (
          tasks.map((task) => {
            const isDone = doneIds.has(task.id);
            const pill = duePill(task.dueDate);
            const href = taskHref(task);
            const meta = [
              `Created ${fmtDate(task.createdAt) ?? "—"}`,
              task.entityTitle,
              task.entityTravelDate ? `Travel ${fmtDate(task.entityTravelDate)}` : null,
              task.entityPrice != null && task.entityPrice !== ""
                ? currency.format(parseFloat(task.entityPrice) || 0)
                : null,
            ]
              .filter(Boolean)
              .join(" - ");
            return (
              <div
                key={task.id}
                role={href ? "link" : "button"}
                tabIndex={0}
                onClick={() => (href ? navigate(href) : setEditingTask(task))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    href ? navigate(href) : setEditingTask(task);
                  }
                }}
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                  isDone && "opacity-50",
                )}
                data-testid={`row-dashboard-task-${task.id}`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={isDone ? "Task completed" : "Mark task complete"}
                  disabled={isDone}
                  onClick={(e) => {
                    e.stopPropagation();
                    completeTask(task.id);
                  }}
                  onKeyDown={(e) => e.stopPropagation()}
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition",
                    isDone
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-black/20 hover:border-emerald-500 dark:border-white/25 dark:hover:border-emerald-400",
                  )}
                  data-testid={`button-complete-dashboard-task-${task.id}`}
                >
                  {isDone && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 text-sm font-medium text-[#fe9a00]">
                       {pill.label}{" "}
                      {new Date(task.dueDate || 0).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                     {task.clientName && (
                       <>
                         <span className="text-black/30 dark:text-white/30">–</span>
                         <span className="shrink-0 text-sm font-semibold text-black/70 dark:text-white/70">
                           {task.clientName}
                         </span>
                       </>
                     )}
                     <span className="text-black/30 dark:text-white/30">–</span>
                    <span className={cn("truncate text-sm font-medium", isDone && "line-through")} data-testid={`text-dashboard-task-title-${task.id}`}>
                      {task.title}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate pl-0.5 text-[13px] text-[#a195a5] dark:text-white/50">
                    {meta}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <InitialsAvatar name={task.clientName || task.title} className="h-6 w-6" />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTask(task);
                    }}
                    className="grid h-7 w-7 place-items-center rounded-full text-black/40 transition hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                    aria-label="Edit task"
                    data-testid={`button-edit-dashboard-task-${task.id}`}
                  >
                    <Ellipsis className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4">
        <Link
          href="/tasks"
          className="text-sm font-semibold text-[#fe9a00] hover:underline"
          data-testid="link-view-all-tasks"
        >
          View All Tasks
        </Link>
      </div>

      <EditTaskDialog
        presentation="drawer"
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        entityType={editingTask?.entityType ?? ""}
        entityId={editingTask?.entityId ?? ""}
      />
    </div>
  );
}
