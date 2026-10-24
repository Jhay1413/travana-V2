import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useUserTasks } from "@/hooks/queries";
import { useUpdateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { EditTaskDialog } from "@/features/tasks/components/tasks/EditTaskDialog";
import type { TaskWithClient } from "@/features/tasks/api/task.api";
import { dealDeepLinkHref } from "@/lib/deal-links";
import { londonDayKey } from "@/lib/london-day";
import { visibleRows } from "@/lib/visible-rows";
import { taskDueRange, type TaskRangeFilter } from "../lib/task-ranges";
import { EmptyLine } from "./home/home-ui";
import { TaskFilters } from "./tasks/task-filters";
import { TaskRow } from "./tasks/task-row";

const MAX_ROWS = 6;

function emptyMessage(filter: TaskRangeFilter, customDate: string): string {
  switch (filter) {
    case "overdue":
      return "Nothing overdue.";
    case "all":
      return "No open tasks. Nice.";
    case "today":
      return "Nothing due today.";
    case "tomorrow":
      return "Nothing due tomorrow.";
    case "this-week":
      return "Nothing due this week.";
    case "custom":
      return `Nothing due on ${customDate}.`;
  }
}

const byDueDate = (a: TaskWithClient, b: TaskWithClient) =>
  new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();

export function TasksTab({ userId }: { userId: string }) {
  const [, navigate] = useLocation();
  const [editingTask, setEditingTask] = useState<TaskWithClient | null>(null);
  const { toast } = useToast();
  // Tasks are not entity-scoped on this dashboard; useUpdateTask also invalidates
  // taskKeys.all, which covers every byUser list regardless of these args.
  const updateTask = useUpdateTask("", "");
  // Ids ticked off in this panel. Applied optimistically so the row reads as done
  // straight away; the incomplete-only list then drops it once it refetches.
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<TaskRangeFilter>("today");
  const [customDate, setCustomDate] = useState<string>(() => londonDayKey(new Date()));

  // Ranges are Europe/London calendar days, matching the server's "due today".
  const dateRange = useMemo(() => taskDueRange(filter, new Date(), customDate), [filter, customDate]);

  // Stable "now" so the overdue query key doesn't change on every render.
  const nowIso = useMemo(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    return d.toISOString();
  }, []);
  const nowMs = useMemo(() => new Date(nowIso).getTime(), [nowIso]);
  const isTaskOverdue = (task: TaskWithClient) =>
    !task.completed && !!task.dueDate && new Date(task.dueDate).getTime() < nowMs;

  const { data: tasksData } = useUserTasks(userId, {
    dueFrom: dateRange.start.toISOString(),
    dueTo: dateRange.end.toISOString(),
    incomplete: true,
  });
  // Dedicated query for overdue tasks: drives both the "Overdue" list and the
  // count badge, regardless of the currently active filter.
  const { data: overdueTasksData } = useUserTasks(userId, { dueTo: nowIso, incomplete: true });

  const overdueTasks = useMemo(() => {
    if (!overdueTasksData || !Array.isArray(overdueTasksData)) return [];
    return overdueTasksData.filter(isTaskOverdue).sort(byDueDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overdueTasksData, nowMs]);

  const tasks = useMemo(() => {
    if (filter === "overdue") return overdueTasks;
    if (!tasksData || !Array.isArray(tasksData)) return [];
    return [...tasksData].sort(byDueDate);
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

  const open = (task: TaskWithClient) => {
    const href = dealDeepLinkHref(task.entityType, task.entityId, task.clientId);
    if (href) navigate(href);
    else setEditingTask(task);
  };

  const shown = visibleRows(tasks, expanded, MAX_ROWS);

  return (
    <div className="flex flex-col" data-testid="panel-dashboard-tasks">
      <TaskFilters
        filter={filter}
        onFilter={(f) => {
          setFilter(f);
          setExpanded(false);
        }}
        overdueCount={overdueTasks.length}
        customDate={customDate}
        onCustomDate={(v) => {
          if (!v) return;
          setCustomDate(v);
          setExpanded(false);
        }}
      />

      {tasks.length === 0 ? (
        <EmptyLine testId="empty-dashboard-tasks">{emptyMessage(filter, customDate)}</EmptyLine>
      ) : (
        <div className={expanded ? "max-h-[60vh] overflow-y-auto" : undefined} data-testid="list-dashboard-tasks">
          {shown.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              isDone={doneIds.has(task.id)}
              isOverdue={isTaskOverdue(task)}
              onOpen={() => open(task)}
              onEdit={() => setEditingTask(task)}
              onComplete={() => completeTask(task.id)}
            />
          ))}
          {!expanded && tasks.length > MAX_ROWS && <EmptyLine testId="text-tasks-more">+ {tasks.length - MAX_ROWS} more</EmptyLine>}
        </div>
      )}

      {tasks.length > MAX_ROWS && (
        <div className="mt-3.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[12px] font-semibold text-social-orange-text hover:underline xl:text-[13px]"
            data-testid="link-view-all-tasks"
          >
            {expanded ? "Show less" : `View all tasks (${tasks.length})`}
          </button>
        </div>
      )}

      <EditTaskDialog
        presentation="drawer"
        open={!!editingTask}
        onOpenChange={(o) => !o && setEditingTask(null)}
        task={editingTask}
        entityType={editingTask?.entityType ?? ""}
        entityId={editingTask?.entityId ?? ""}
      />
    </div>
  );
}
