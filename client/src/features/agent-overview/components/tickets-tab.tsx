import { useMemo } from "react";
import { Link, useLocation } from "wouter";
import { ChevronRight } from "lucide-react";
import { useTicketsByUser } from "@/features/tickets/api/use-ticket-queries";
import { cn } from "@/lib/utils";
import { InitialsAvatar, timeAgo } from "./dashboard-ui";

function statusPill(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "open") return "bg-red-500 text-white";
  if (s.includes("progress")) return "bg-amber-500 text-white";
  if (s === "resolved") return "bg-emerald-500 text-white";
  return "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60";
}

export function TicketsTab({ userId }: { userId: string }) {
  const [, navigate] = useLocation();
  const { data: ticketsData } = useTicketsByUser(userId, { statuses: ["open", "in_progress"] });

  const tickets = useMemo(() => {
    if (!ticketsData || !Array.isArray(ticketsData)) return [];
    return [...ticketsData]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [ticketsData]);

  return (
    <div className="flex min-h-[300px] flex-col" data-testid="panel-dashboard-tickets">
      <div className="flex-1 space-y-1">
        {tickets.length === 0 ? (
          <div
            className="rounded-lg border border-dashed border-black/10 p-8 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45"
            data-testid="empty-dashboard-tickets"
          >
            No open tickets
          </div>
        ) : (
          tickets.map((ticket: any) => (
            <div
              key={ticket.id}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/tickets/${ticket.id}`);
                }
              }}
              className="group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              data-testid={`row-dashboard-ticket-${ticket.id}`}
            >
              <InitialsAvatar name={ticket.clientName || ticket.subject} className="h-8 w-8 text-[11px]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[17px] font-medium">{ticket.subject}</span>
                  <span className="shrink-0 text-xs text-black/40 dark:text-white/40">
                    {timeAgo(ticket.createdAt)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[13px] text-[#a195a5] dark:text-white/50">
                  {[ticket.clientName, ticket.type, ticket.priority && `${ticket.priority} priority`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-sm px-2.5 py-1 text-[11px] font-semibold",
                  statusPill(ticket.status),
                )}
              >
                {ticket.status}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
            </div>
          ))
        )}
      </div>

      <div className="mt-4">
        <Link
          href="/tickets"
          className="text-sm font-semibold text-[#fe9a00] hover:underline"
          data-testid="link-view-all-tickets"
        >
          View All Tickets
        </Link>
      </div>
    </div>
  );
}
