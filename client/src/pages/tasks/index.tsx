import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, ListChecks, Plus } from "lucide-react";
import { useCurrentUser } from "@/hooks/queries";
import { useUpdateTask } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { useUserTasks } from "@/features/tasks";
import type { TaskWithClient } from "@/features/tasks/api/task.api";
import { CreateTaskDialog } from "@/features/tasks/components/tasks/CreateTaskDialog";
import { EditTaskDialog } from "@/features/tasks/components/tasks/EditTaskDialog";
import { cn } from "@/lib/utils";
import { dealDeepLinkHref } from "@/lib/deal-links";

type TasksFilter = "all" | "overdue" | "today" | "this-week" | "completed";

const FILTERS: ReadonlyArray<{ key: TasksFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "this-week", label: "This Week" },
  { key: "completed", label: "Completed" },
];

const ENTITY_LABELS: Record<string, string> = {
  quote: "Quote",
  booking: "Booking",
  enquiry: "Enquiry",
  client: "Client",
};

function formatDue(d: Date): string {
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export default function TasksPage() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id || "";
  const { toast } = useToast();
  // Tasks are not entity-scoped here; useUpdateTask also invalidates taskKeys.all,
  // which covers every byUser list regardless of these args.
  const updateTask = useUpdateTask("", "");
  const [filter, setFilter] = useState<TasksFilter>("all");
  const [creating, setCreating] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithClient | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // Ids ticked off on this page, applied optimistically until the refetch lands.
  const [doneIds, setDoneIds] = useState<ReadonlySet<string>>(new Set());

  // Every task assigned to the current user, open and completed; filtered locally.
  const { data, isLoading } = useUserTasks(userId);

  const { visible, overdueCount } = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const all = Array.isArray(data) ? data : [];
    const isDone = (t: TaskWithClient) => !!t.completed || doneIds.has(t.id);
    const dueMs = (t: TaskWithClient) => (t.dueDate ? new Date(t.dueDate).getTime() : null);
    const open = all.filter((t) => !isDone(t));
    const overdue = open.filter((t) => {
      const ms = dueMs(t);
      return ms !== null && ms < now.getTime();
    });
    const inRange = (t: TaskWithClient, from: Date, to: Date) => {
      const ms = dueMs(t);
      return ms !== null && ms >= from.getTime() && ms < to.getTime();
    };
    const byDue = (a: TaskWithClient, b: TaskWithClient) =>
      (dueMs(a) ?? Infinity) - (dueMs(b) ?? Infinity);

    let list: TaskWithClient[];
    switch (filter) {
      case "overdue":
        list = overdue;
        break;
      case "today":
        list = open.filter((t) => inRange(t, startOfToday, startOfTomorrow));
        break;
      case "this-week":
        list = open.filter((t) => inRange(t, startOfWeek, endOfWeek));
        break;
      case "completed":
        list = all.filter(isDone);
        break;
      default:
        list = open;
    }
    return { visible: [...list].sort(byDue), overdueCount: overdue.length };
  }, [data, doneIds, filter]);

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

  const openEdit = (task: TaskWithClient) => {
    setEditingTask(task);
    setEditOpen(true);
  };

  const addButton = (label: string) => (
    <button
      type="button"
      onClick={() => setCreating(true)}
      className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
      data-testid="button-new-task"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6" data-testid="page-tasks">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-black/60 dark:text-white/60" aria-hidden />
          <h1 className="text-xl font-semibold">My Tasks</h1>
        </div>
        {visible.length > 0 && addButton("New Task")}
      </div>

      <div className="flex flex-wrap items-center gap-2" data-testid="tasks-filters">
        {FILTERS.map(({ key, label }) => {
          const isOverdueChip = key === "overdue";
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "relative rounded-md px-2.5 py-1 text-[11px] font-semibold transition",
                filter === key
                  ? isOverdueChip
                    ? "bg-red-600 text-white"
                    : "bg-black text-white dark:bg-white dark:text-black"
                  : isOverdueChip
                    ? "border border-red-500/30 bg-red-500/5 text-red-700 hover:bg-red-500/10 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20"
                    : "border border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10",
              )}
              data-testid={`button-tasks-filter-${key}`}
            >
              {label}
              {isOverdueChip && overdueCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white dark:ring-black">
                  {overdueCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-black/45 dark:text-white/45">Loading tasks...</div>
      ) : visible.length === 0 ? (
        <div
          className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center"
          data-testid="empty-tasks"
        >
          <p className="text-sm text-black/50 dark:text-white/50">
            {filter === "all"
              ? "No open tasks"
              : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} tasks`}
          </p>
          {addButton("Add Task")}
        </div>
      ) : (
        <div className="space-y-1">
          {visible.map((task) => {
            const done = !!task.completed || doneIds.has(task.id);
            const due = task.dueDate ? new Date(task.dueDate) : null;
            const isOverdue = !done && !!due && due.getTime() < Date.now();
            const href = dealDeepLinkHref(task.entityType, task.entityId, task.clientId);
            const contextLabel = [
              task.clientName,
              task.entityTitle ?? (task.entityType ? ENTITY_LABELS[task.entityType] : null),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div
                key={task.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/[0.04]",
                  done && "opacity-50",
                )}
                role="button"
                tabIndex={0}
                aria-label={`Edit task: ${task.title ?? "Untitled"}`}
                onClick={() => openEdit(task)}
                onKeyDown={(e) => {
                  // Only the row itself; Enter/Space on the checkbox or link keep their own behavior.
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openEdit(task);
                  }
                }}
                data-testid={`row-task-${task.id}`}
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={done ? "Task completed" : "Mark task complete"}
                  disabled={done}
                  onClick={(e) => {
                    e.stopPropagation();
                    completeTask(task.id);
                  }}
                  className={cn(
                    "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition",
                    done
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-black/20 hover:border-emerald-500 dark:border-white/25 dark:hover:border-emerald-400",
                  )}
                  data-testid={`button-complete-task-${task.id}`}
                >
                  {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={cn("text-sm font-medium", done && "line-through")}>{task.title}</div>
                  {task.description && (
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-black/55 dark:text-white/55">
                      {task.description}
                    </p>
                  )}
                  {contextLabel &&
                    (href ? (
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 inline-block text-[13px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                        data-testid={`link-task-deal-${task.id}`}
                      >
                        {contextLabel}
                      </Link>
                    ) : (
                      <div className="mt-0.5 text-[13px] text-[#a195a5] dark:text-white/50">{contextLabel}</div>
                    ))}
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-medium",
                    isOverdue ? "text-red-600 dark:text-red-400" : "text-black/50 dark:text-white/50",
                  )}
                  data-testid={`text-task-due-${task.id}`}
                >
                  {due ? formatDue(due) : "No date"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <EditTaskDialog
        presentation="drawer"
        open={editOpen}
        onOpenChange={setEditOpen}
        task={editingTask}
        entityType={editingTask?.entityType ?? ""}
        entityId={editingTask?.entityId ?? ""}
      />

      <CreateTaskDialog
        presentation="drawer"
        open={creating}
        onOpenChange={setCreating}
        defaultAssignedToId={userId}
      />
    </div>
  );
}
