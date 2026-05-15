import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListChecks, LifeBuoy, ChevronRight, AlertTriangle } from "lucide-react";
import { useState } from "react";
import type {
  OrganizationOverviewAttention,
  OrganizationOverviewAttentionItem,
} from "@/api/endpoints/organization-overview.api";

function priorityTone(priority: string | null): string {
  const p = (priority ?? "").toLowerCase();
  if (p === "urgent" || p === "high") return "bg-rose-500/15 text-rose-600";
  if (p === "medium") return "bg-amber-500/15 text-amber-600";
  if (p === "low") return "bg-emerald-500/15 text-emerald-600";
  return "bg-slate-500/15 text-slate-600";
}

function formatDue(due: string | null): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  if (diffDays < 7) return `Due in ${diffDays}d`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function ItemRow({
  item,
  href,
  testId,
}: {
  item: OrganizationOverviewAttentionItem;
  href: string;
  testId: string;
}) {
  const due = formatDue(item.dueDate);
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start justify-between gap-2 py-2"
        data-testid={testId}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{item.title}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            {item.priority ? (
              <span
                className={`rounded-full px-1.5 py-0.5 font-medium ${priorityTone(item.priority)}`}
              >
                {item.priority}
              </span>
            ) : null}
            {item.status ? <span>{item.status}</span> : null}
            {due ? <span>· {due}</span> : null}
          </div>
        </div>
        <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      </Link>
    </li>
  );
}

export function AttentionCard({ attention }: { attention: OrganizationOverviewAttention }) {
  const [tab, setTab] = useState<"tasks" | "tickets">("tasks");
  const recentTasks = attention.recentTasks ?? [];
  const recentTickets = attention.recentTickets ?? [];

  return (
    <Card className="glass ringed grain rounded-2xl p-4 md:p-5" data-testid="attention-card">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <div className="text-sm font-medium">Tasks and Tickets</div>
      </div>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "tasks" | "tickets")}
        className="mb-3"
      >
        <TabsList className="h-7 w-full rounded-2xl bg-black/5 dark:bg-white/5">
          <TabsTrigger
            value="tasks"
            className="h-6 flex-1 rounded-xl px-2 text-[11px]"
            data-testid="tab-tasks"
          >
            <ListChecks className="mr-1 h-3 w-3" />
            Tasks · {attention.overdueTasks}
          </TabsTrigger>
          <TabsTrigger
            value="tickets"
            className="h-6 flex-1 rounded-xl px-2 text-[11px]"
            data-testid="tab-tickets"
          >
            <LifeBuoy className="mr-1 h-3 w-3" />
            Tickets · {attention.openTickets}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "tasks" ? (
        recentTasks.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No open tasks. Nice.
          </div>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {recentTasks.map((t) => (
              <ItemRow
                key={t.id}
                item={t}
                href={`/tasks?id=${t.id}`}
                testId={`row-task-${t.id}`}
              />
            ))}
          </ul>
        )
      ) : recentTickets.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No open tickets. Nice.
        </div>
      ) : (
        <ul className="divide-y divide-black/5 dark:divide-white/5">
          {recentTickets.map((t) => (
            <ItemRow
              key={t.id}
              item={t}
              href={`/tickets?id=${t.id}`}
              testId={`row-ticket-${t.id}`}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-end">
        <Link
          href={tab === "tasks" ? "/tasks" : "/tickets"}
          className="text-[11px] text-muted-foreground hover:text-foreground"
          data-testid="link-attention-view-all"
        >
          View all →
        </Link>
      </div>
    </Card>
  );
}
