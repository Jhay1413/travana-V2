import { LifeBuoy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/features/tickets/types";
import type { User as ApiUser } from "@/features/user/types";

// Status pill classes come from the redesign tokens (status-* / ticket-amber-*).
function statusClass(status: string): string {
  switch (status) {
    case "Open":
      return "bg-status-posted-bg text-status-posted-fg";
    case "In Progress":
      return "bg-ticket-amber-bg text-ticket-amber-fg";
    case "Resolved":
      return "bg-status-scheduled-bg text-status-scheduled-fg";
    default:
      return "bg-status-draft-bg text-status-draft-fg";
  }
}

interface ClientTicketsTabProps {
  tickets: Ticket[];
  users: ApiUser[];
  /** Hidden for read-only roles. */
  onNewTicket?: () => void;
  /** Rows open the ticket page (/tickets/:ticketId). */
  onOpenTicket: (ticketId: string) => void;
}

export function ClientTicketsTab({ tickets, users, onNewTicket, onOpenTicket }: ClientTicketsTabProps) {
  const getUserName = (userId: string) => users.find((u) => u.id === userId)?.name || "Unassigned";

  return (
    <div data-testid="list-tickets">
      <div className="mb-1 flex items-center justify-between gap-3 pb-2">
        <p className="text-xs text-social-muted">
          {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
        </p>
        {onNewTicket && (
          <Button type="button" size="sm" variant="outline" className="h-8 rounded-[10px]" onClick={onNewTicket} data-testid="button-client-ticket-create">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New ticket
          </Button>
        )}
      </div>

      {tickets.length === 0 ? (
        <div className="border-t border-social-border py-10 text-center">
          <LifeBuoy className="mx-auto mb-2 h-8 w-8 text-social-muted/50" />
          <p className="text-sm font-medium">No tickets yet</p>
          {onNewTicket && (
            <button
              type="button"
              onClick={onNewTicket}
              className="mt-3 text-[13px] font-semibold text-social-orange-text hover:underline"
              data-testid="client-index-tickets-empty-add"
            >
              Raise the first ticket
            </button>
          )}
        </div>
      ) : (
        tickets.map((t) => {
          const assignedName = t.assignedToName || getUserName(t.assignedTo || t.userId);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onOpenTicket(t.id)}
              className="flex w-full items-center gap-3.5 border-t border-social-border py-4 text-left transition hover:bg-muted/50"
              data-testid={`card-client-ticket-${t.id}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" data-testid={`text-ticket-subject-${t.id}`}>
                  {t.subject}
                </p>
                <p className="mt-0.5 truncate text-xs text-social-muted">
                  TKT-{t.id.slice(-4).padStart(4, "0")} · {t.type} · {t.priority} · {assignedName}
                </p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", statusClass(t.status))}>{t.status}</span>
            </button>
          );
        })
      )}
    </div>
  );
}
