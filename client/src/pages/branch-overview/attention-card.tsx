import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  LifeBuoy,
  ListChecks,
  ChevronRight,
} from "lucide-react";
import type { BranchOverviewAttention } from "@/api/endpoints/branch-overview.api";

interface Row {
  label: string;
  value: number;
  href: string;
  icon: React.ElementType;
  tone: string;
}

export function AttentionCard({ attention }: { attention: BranchOverviewAttention }) {
  const rows: Row[] = [
    {
      label: "Departing in 7 days",
      value: attention.upcomingDepartures7d,
      href: "/bookings?range=7d",
      icon: CalendarClock,
      tone: "text-sky-600",
    },
    {
      label: "Departing in 30 days",
      value: attention.upcomingDepartures30d,
      href: "/bookings?range=30d",
      icon: CalendarClock,
      tone: "text-indigo-600",
    },
    {
      label: "Quotes going stale (>14d)",
      value: attention.staleQuotes,
      href: "/pipeline?status=stale",
      icon: Clock,
      tone: "text-amber-600",
    },
    {
      label: "Open tickets",
      value: attention.openTickets,
      href: "/tickets?status=open",
      icon: LifeBuoy,
      tone: "text-rose-600",
    },
    {
      label: "Overdue tasks",
      value: attention.overdueTasks,
      href: "/tasks?overdue=1",
      icon: ListChecks,
      tone: "text-fuchsia-600",
    },
  ];

  return (
    <Card className="glass ringed grain rounded-2xl p-4 md:p-5" data-testid="attention-card">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <div className="text-sm font-medium">Needs attention</div>
      </div>
      <ul className="divide-y divide-black/5 dark:divide-white/5">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <li key={r.label}>
              <Link
                href={r.href}
                className="group flex items-center justify-between gap-3 py-2.5"
                data-testid={`attention-row-${r.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
              >
                <div className="flex items-center gap-2 text-sm">
                  <Icon className={`h-4 w-4 ${r.tone}`} />
                  <span>{r.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold tabular-nums">
                    {r.value.toLocaleString()}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
