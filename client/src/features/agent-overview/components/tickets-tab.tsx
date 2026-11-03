import { useMemo } from "react";
import { useLocation } from "wouter";
import { useTicketsByUser } from "@/features/tickets/api/use-ticket-queries";
import { cn } from "@/lib/utils";
import { EmptyLine, HomeLink, HomePill, RowButton } from "./home/home-ui";

function statusPill(status: string): string {
  const s = (status || "").toLowerCase();
  if (s === "open") return "bg-status-failed-bg text-status-failed-fg";
  if (s.includes("progress")) return "bg-stage-inplay-bg text-stage-inplay-fg";
  if (s === "resolved") return "bg-status-scheduled-bg text-status-scheduled-fg";
  return "bg-status-draft-bg text-status-draft-fg";
}

function priorityDot(priority: string): string {
  const p = (priority || "").toLowerCase();
  if (p === "urgent" || p === "high") return "bg-priority-high";
  if (p === "medium") return "bg-priority-medium";
  return "bg-priority-low";
}

function dueLabel(due: string | null): string | null {
  if (!due) return null;
  const d = new Date(due);
  if (isNaN(d.getTime())) return null;
  return `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

export function TicketsTab({ userId }: { userId: string }) {
  const [, navigate] = useLocation();
  const { data: ticketsData } = useTicketsByUser(userId, {
    statuses: ["open", "in_progress"],
    // "My tickets" on this personal panel means tickets assigned to me —
    // not tickets I raised for someone else. `findByAssignedTo`'s default
    // (creator-or-assignee) still backs other callers of this same endpoint
    // (sidebar badge, "what's on" widget), so this is opted in explicitly
    // rather than changing that shared default.
    assignedOnly: true,
  });

  const tickets = useMemo(() => {
    if (!ticketsData || !Array.isArray(ticketsData)) return [];
    return [...ticketsData]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [ticketsData]);

  return (
    <div className="flex flex-col" data-testid="panel-dashboard-tickets">
      {tickets.length === 0 ? (
        <EmptyLine testId="empty-dashboard-tickets">No open tickets assigned to you.</EmptyLine>
      ) : (
        tickets.map((ticket) => (
          <RowButton
            key={ticket.id}
            onActivate={() => navigate(`/tickets/${ticket.id}`)}
            className="flex items-center gap-3 rounded-none border-t border-social-border py-3 hover:bg-social-page"
            testId={`row-dashboard-ticket-${ticket.id}`}
          >
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", priorityDot(ticket.priority))}
              title={`${ticket.priority} priority`}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold xl:text-[14px]">{ticket.subject}</div>
              <div className="truncate text-[11px] text-social-muted xl:text-[12px]">
                {[ticket.id.slice(0, 8), ticket.clientName, dueLabel(ticket.dueDate)].filter(Boolean).join(" · ")}
              </div>
            </div>
            <HomePill className={statusPill(ticket.status)}>{ticket.status}</HomePill>
          </RowButton>
        ))
      )}

      <div className="mt-3.5">
        <HomeLink href="/tickets" testId="link-view-all-tickets">
          Open tickets
        </HomeLink>
      </div>
    </div>
  );
}
