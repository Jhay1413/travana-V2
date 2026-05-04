import { useState } from "react";
import { LifeBuoy, MessageCircle, Plus, Search, Tag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketDetailPanel } from "@/components/tickets-board";
import type { Ticket } from "@/types/ticket";
import type { User as ApiUser } from "@/types/user";

// ── helpers (mirrors tickets-board.tsx) ───────────────────────────────────────

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function priorityDotColor(priority: string) {
  switch (priority) {
    case "Urgent": return "bg-red-500";
    case "High":   return "bg-orange-500";
    case "Medium": return "bg-yellow-500";
    case "Low":    return "bg-blue-400";
    default:       return "bg-slate-400";
  }
}

// ── component ─────────────────────────────────────────────────────────────────

interface ClientTicketsTabProps {
  tickets: Ticket[];
  users: ApiUser[];
  onNewTicket: () => void;
}

export function ClientTicketsTab({ tickets, users, onNewTicket }: ClientTicketsTabProps) {
  const [activeTicketId, setActiveTicketId] = useState<string | null>(
    tickets.length > 0 ? tickets[0].id : null,
  );
  const [query, setQuery] = useState("");

  const filtered = tickets.filter((t) => {
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return `${t.subject} ${t.status} ${t.type} ${t.priority} ${t.description ?? ""}`
      .toLowerCase()
      .includes(q);
  });

  const activeTicket = tickets.find((t) => t.id === activeTicketId) ?? null;

  const getUserName = (userId: string) =>
    users.find((u) => u.id === userId)?.name || "Unassigned";

  return (
    <div
      className="flex overflow-hidden rounded-2xl border border-black/10 bg-white"
      style={{ height: "calc(100vh - 260px)", minHeight: 520 }}
      data-testid="client-tickets-panel"
    >
      {/* ── Left: ticket list ── */}
      <div className="flex w-[38%] min-w-[260px] max-w-[400px] flex-col border-r border-slate-200 bg-white">
        {/* search + new button */}
        <div className="flex items-center gap-2 border-b border-slate-100 p-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tickets…"
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              data-testid="input-search-client-tickets"
            />
          </div>
          <button
            type="button"
            onClick={onNewTicket}
            className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            data-testid="button-client-ticket-create"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>

        {/* list */}
        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <LifeBuoy className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No tickets found</p>
              <p className="mt-1 text-xs text-slate-400">
                {query.trim() ? "Try a different search" : "Create the first ticket for this client"}
              </p>
            </div>
          ) : (
            filtered.map((ticket) => {
              const isActive = ticket.id === activeTicketId;
              const assignedName =
                ticket.assignedToName || getUserName(ticket.assignedTo || ticket.userId);
              return (
                <div
                  key={ticket.id}
                  onClick={() => setActiveTicketId(ticket.id)}
                  className={`cursor-pointer py-3.5 pl-5 pr-4 transition-colors ${
                    isActive ? "bg-slate-200/80" : "hover:bg-slate-50"
                  }`}
                  data-testid={`card-client-ticket-${ticket.id}`}
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div
                        className={`h-2 w-2 flex-none rounded-full ${priorityDotColor(ticket.priority)}`}
                      />
                      <h3 className="truncate text-sm font-semibold text-slate-900">
                        {ticket.subject}
                      </h3>
                    </div>
                    <span className="flex-none text-xs text-slate-500">
                      {formatDate(ticket.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        {ticket.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {assignedName}
                      </span>
                    </div>
                    {(ticket.replyCount ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <MessageCircle className="h-3 w-3" />
                        {ticket.replyCount}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: detail panel ── */}
      {activeTicket ? (
        <TicketDetailPanel
          ticket={activeTicket}
          users={users}
          onClose={() => setActiveTicketId(null)}
          onAfterDelete={() => setActiveTicketId(null)}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center bg-slate-50">
          <div className="text-center">
            <LifeBuoy className="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm font-medium text-slate-500">Select a ticket to view details</p>
            <p className="mt-1 text-xs text-slate-400">
              Choose a ticket from the list on the left
            </p>
            <Button className="mt-4" size="sm" onClick={onNewTicket} data-testid="button-client-ticket-create-empty">
              <Plus className="mr-1.5 h-4 w-4" />
              Create Ticket
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
