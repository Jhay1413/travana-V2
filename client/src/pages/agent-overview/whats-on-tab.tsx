import { useMemo, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ChevronRight, LifeBuoy, ListChecks } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import { useAllTasksExtended, useUserTasks } from "@/hooks/queries";
import { useTickets, useTicketsByUser } from "@/hooks/queries/use-ticket-queries";
import { currency } from "./helpers";

export type WhatsOnFilter = "all" | "today" | "tomorrow" | "this-week" | "custom";

export function WhatsOnTab({
  userId,
  whatsOnFilter,
  whatsOnDate,
  setWhatsOnFilter,
  setWhatsOnDate,
  allUsers = false,
  extraControls,
}: {
  userId: string;
  whatsOnFilter: WhatsOnFilter;
  whatsOnDate: string;
  setWhatsOnFilter: (f: WhatsOnFilter) => void;
  setWhatsOnDate: (d: string) => void;
  allUsers?: boolean;
  extraControls?: ReactNode;
}) {
  const [, navigate] = useLocation();

  const fmtDate = (d?: string | Date | null) => {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

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

    switch (whatsOnFilter) {
      case "all":
        return { start: new Date(0), end: new Date(2100, 0, 1) };
      case "today":
        return { start: today, end: tomorrow };
      case "tomorrow":
        return { start: tomorrow, end: endOfTomorrow };
      case "this-week":
        return { start: startOfWeek, end: endOfWeek };
      case "custom": {
        const d = new Date(whatsOnDate);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        return { start: d, end: next };
      }
    }
  }, [whatsOnFilter, whatsOnDate]);

  const dueFrom = dateRange?.start.toISOString();
  const dueTo = dateRange?.end.toISOString();

  const { data: userTasksData } = useUserTasks(allUsers ? "" : userId, {
    dueFrom,
    dueTo,
    incomplete: true,
  });
  const { data: userTicketsData } = useTicketsByUser(allUsers ? "" : userId, {
    statuses: ["open", "in_progress"],
  });
  const { data: allTasksRaw } = useAllTasksExtended();
  const { data: allTicketsRaw } = useTickets();

  const filteredTasks = useMemo(() => {
    if (allUsers) {
      if (!allTasksRaw || !Array.isArray(allTasksRaw)) return [];
      const startMs = dateRange?.start.getTime() ?? 0;
      const endMs = dateRange?.end.getTime() ?? Number.MAX_SAFE_INTEGER;
      return allTasksRaw
        .filter((t: any) => !t.completed)
        .filter((t: any) => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate).getTime();
          return due >= startMs && due < endMs;
        })
        .sort(
          (a: any, b: any) =>
            new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime(),
        );
    }
    if (!userTasksData || !Array.isArray(userTasksData)) return [];
    return [...userTasksData].sort(
      (a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime(),
    );
  }, [allUsers, userTasksData, allTasksRaw, dateRange]);

  const filteredTickets = useMemo(() => {
    if (allUsers) {
      if (!allTicketsRaw || !Array.isArray(allTicketsRaw)) return [];
      return allTicketsRaw
        .filter((t: any) => {
          const s = String(t.status || "").toLowerCase();
          return s === "open" || s === "in progress" || s === "in_progress";
        })
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    }
    if (!userTicketsData || !Array.isArray(userTicketsData)) return [];
    return [...userTicketsData].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [allUsers, userTicketsData, allTicketsRaw]);

  return (
    <div className="grid gap-4" data-testid="panel-whats-on-overview">
      <div className="flex flex-wrap items-center gap-2" data-testid="whats-on-filters">
        {(["all", "today", "tomorrow", "this-week", "custom"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setWhatsOnFilter(f)}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              whatsOnFilter === f
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "border border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
            }`}
            data-testid={`button-whats-on-${f}`}
          >
            {f === "all"
              ? "All"
              : f === "today"
                ? "Today"
                : f === "tomorrow"
                  ? "Tomorrow"
                  : f === "this-week"
                    ? "This Week"
                    : "Select Date"}
          </button>
        ))}
        {whatsOnFilter === "custom" && (
          <DatePicker
            value={whatsOnDate}
            onChange={(v) => setWhatsOnDate(v)}
            placeholder="Pick a date"
            data-testid="input-whats-on-date"
          />
        )}
        {extraControls}
      </div>

      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-black/50 dark:text-white/50" />
          <div className="text-sm font-semibold" data-testid="text-whats-on-tasks-title">
            Tasks ({filteredTasks.length})
          </div>
        </div>
        {filteredTasks.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45"
            data-testid="empty-whats-on-tasks"
          >
            No tasks due{" "}
            {whatsOnFilter === "today"
              ? "today"
              : whatsOnFilter === "tomorrow"
                ? "tomorrow"
                : whatsOnFilter === "this-week"
                  ? "this week"
                  : `on ${whatsOnDate}`}
          </div>
        ) : (
          filteredTasks.map((task, idx) => {
            let taskHref: string | null = null;
            if (task.entityType === "quote" && task.entityId) {
              taskHref = task.clientId
                ? `/clients/${task.clientId}/quotes/${task.entityId}`
                : `/quotes/${task.entityId}`;
            } else if (task.entityType === "booking" && task.entityId) {
              taskHref = task.clientId
                ? `/clients/${task.clientId}/bookings/${task.entityId}`
                : `/bookings/${task.entityId}`;
            } else if (task.entityType === "enquiry" && task.entityId) {
              taskHref = task.clientId
                ? `/clients/${task.clientId}/enquiries/${task.entityId}`
                : `/enquiries/${task.entityId}`;
            } else if (task.entityType === "client" && task.clientId) {
              taskHref = `/clients/${task.clientId}`;
            }
            return (
              <motion.button
                key={task.id}
                type="button"
                className={`group w-full rounded-2xl border p-3 text-left transition ${task.completed ? "border-emerald-500/20 bg-emerald-500/5" : "border-black/10 bg-black/5 hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"} ${taskHref ? "cursor-pointer" : "cursor-default"}`}
                data-testid={`card-whats-on-task-${task.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                onClick={() => taskHref && navigate(taskHref)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className={`h-2 w-2 shrink-0 rounded-full ${task.completed ? "bg-emerald-500" : "bg-amber-500"}`}
                      />
                      <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/60">
                        {new Date(task.dueDate || 0).toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className="truncate text-sm font-medium"
                        data-testid={`text-whats-on-task-title-${task.id}`}
                      >
                        {task.clientName && (
                          <span className="text-blue-600 dark:text-blue-400">
                            {task.clientName} —{" "}
                          </span>
                        )}
                        {task.title}
                      </span>
                      {task.tags?.map((tag: string) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300"
                          data-testid={`pill-whats-on-task-tag-${task.id}-${tag}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {(task.entityTitle || task.entityPrice || task.entityCommission) && (
                      <div
                        className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-4 text-[11px] text-black/55 dark:text-white/55"
                        data-testid={`text-whats-on-task-meta-${task.id}`}
                      >
                        {task.entityTitle && (
                          <span className="truncate font-medium text-black/70 dark:text-white/70">
                            {task.entityTitle}
                          </span>
                        )}
                        {task.entityPrice != null && task.entityPrice !== "" && (
                          <span data-testid={`text-whats-on-task-price-${task.id}`}>
                            {currency.format(parseFloat(task.entityPrice) || 0)}
                          </span>
                        )}
                        {task.entityCommission != null && task.entityCommission !== "" && (
                          <span
                            className="font-semibold text-emerald-600 dark:text-emerald-400"
                            data-testid={`text-whats-on-task-commission-${task.id}`}
                          >
                            Comm {currency.format(parseFloat(task.entityCommission) || 0)}
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-4 text-[11px] text-black/45 dark:text-white/45"
                      data-testid={`text-whats-on-task-dates-${task.id}`}
                    >
                      <span data-testid={`text-whats-on-task-created-${task.id}`}>
                        Created {fmtDate(task.createdAt) ?? "—"}
                      </span>
                      {task.entityTravelDate && (
                        <span
                          className="font-medium text-sky-600 dark:text-sky-400"
                          data-testid={`text-whats-on-task-travel-${task.id}`}
                        >
                          Travel {fmtDate(task.entityTravelDate)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${task.completed ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}
                    >
                      {task.completed ? "Done" : "Pending"}
                    </span>
                    {taskHref && (
                      <ChevronRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      <Separator className="bg-black/10 dark:bg-white/10" />

      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4 text-black/50 dark:text-white/50" />
          <div className="text-sm font-semibold" data-testid="text-whats-on-tickets-title">
            Tickets ({filteredTickets.length})
          </div>
        </div>
        {filteredTickets.length === 0 ? (
          <div
            className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45"
            data-testid="empty-whats-on-tickets"
          >
            No tickets{" "}
            {whatsOnFilter === "today"
              ? "today"
              : whatsOnFilter === "tomorrow"
                ? "tomorrow"
                : whatsOnFilter === "this-week"
                  ? "this week"
                  : `on ${whatsOnDate}`}
          </div>
        ) : (
          filteredTickets.map((ticket, idx) => (
            <motion.button
              key={ticket.id}
              type="button"
              className="group w-full rounded-2xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
              data-testid={`card-whats-on-ticket-${ticket.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/60">
                      {new Date(ticket.createdAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className="truncate text-sm font-medium"
                      data-testid={`text-whats-on-ticket-subject-${ticket.id}`}
                    >
                      {ticket.clientName && (
                        <span className="text-blue-600 dark:text-blue-400">
                          {ticket.clientName} —{" "}
                        </span>
                      )}
                      {ticket.subject}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                        ticket.priority === "Urgent"
                          ? "border-red-500/25 bg-red-500/10 text-red-700"
                          : ticket.priority === "High"
                            ? "border-amber-500/25 bg-amber-500/10 text-amber-700"
                            : "border-black/10 bg-black/[0.03] text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                      }`}
                      data-testid={`pill-whats-on-ticket-priority-${ticket.id}`}
                    >
                      {ticket.priority}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                        ticket.status === "Open"
                          ? "border-red-500/25 bg-red-500/10 text-red-700"
                          : ticket.status === "In Progress"
                            ? "border-amber-500/25 bg-amber-500/10 text-amber-700"
                            : ticket.status === "Resolved"
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                              : "border-black/10 bg-black/[0.03] text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                      }`}
                      data-testid={`pill-whats-on-ticket-status-${ticket.id}`}
                    >
                      {ticket.status}
                    </span>
                  </div>
                  <div
                    className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-black/45 dark:text-white/45"
                    data-testid={`text-whats-on-ticket-dates-${ticket.id}`}
                  >
                    <span data-testid={`text-whats-on-ticket-created-${ticket.id}`}>
                      Created {fmtDate(ticket.createdAt) ?? "—"}
                    </span>
                    {ticket.dueDate && (
                      <span data-testid={`text-whats-on-ticket-due-${ticket.id}`}>
                        Due {fmtDate(ticket.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
              </div>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
}
