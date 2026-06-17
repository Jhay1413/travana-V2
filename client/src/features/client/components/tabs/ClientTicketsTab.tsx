import { useState } from "react";
import { LifeBuoy, MessageCircle, Plus, Tag, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TicketDetailPanel } from "@/features/social/components/boards/tickets-board";
import type { Ticket } from "@/features/tickets/types";
import type { User as ApiUser } from "@/types/user";

// ── helpers ───────────────────────────────────────────────────────────────────

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

function statusStyle(status: string) {
  switch (status) {
    case "Open":        return "bg-blue-50 text-blue-700 border-blue-200";
    case "In Progress": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Resolved":    return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Closed":      return "bg-slate-100 text-slate-600 border-slate-300";
    default:            return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

function typeBadgeStyle(type: string) {
  switch (type) {
    case "Admin": return "bg-violet-100 text-violet-700 border-violet-200";
    case "Build": return "bg-sky-100 text-sky-700 border-sky-200";
    case "Sales": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

// ── component ─────────────────────────────────────────────────────────────────

interface ClientTicketsTabProps {
  tickets: Ticket[];
  users: ApiUser[];
  onNewTicket: () => void;
}

export function ClientTicketsTab({ tickets, users, onNewTicket }: ClientTicketsTabProps) {
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);

  const getUserName = (userId: string) =>
    users.find((u) => u.id === userId)?.name || "Unassigned";

  return (
    <>
      {/* ── list ── */}
      <div className="grid gap-3" data-testid="list-tickets">
        <div className="flex items-center justify-between">
          <p className="text-xs text-black/45">
            {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
          </p>
          <Button
            type="button"
            size="sm"
            className="rounded-2xl bg-blue-600 text-white hover:bg-blue-700"
            onClick={onNewTicket}
            data-testid="button-client-ticket-create"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Ticket
          </Button>
        </div>

        {tickets.length === 0 ? (
          <div className="rounded-3xl border border-black/10 bg-white/60 py-10 text-center">
            <LifeBuoy className="mx-auto mb-2 h-8 w-8 text-black/20" />
            <p className="text-sm font-medium text-black/50">No tickets yet</p>
            <p className="mt-1 text-xs text-black/35">Create the first ticket for this client</p>
          </div>
        ) : (
          tickets.map((t) => {
            const assignedName =
              t.assignedToName || getUserName(t.assignedTo || t.userId);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTicket(t)}
                className="group w-full rounded-2xl border border-black/10 bg-white/70 p-4 text-left transition hover:border-black/20 hover:bg-white hover:shadow-sm"
                data-testid={`card-client-ticket-${t.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-2.5">
                    <div className={`mt-1.5 h-2 w-2 flex-none rounded-full ${priorityDotColor(t.priority)}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-black/85" data-testid={`text-ticket-subject-${t.id}`}>
                        {t.subject}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${typeBadgeStyle(t.type)}`}>
                          {t.type}
                        </span>
                        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${statusStyle(t.status)}`}>
                          {t.status}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-black/40">
                          <Zap className="h-2.5 w-2.5" />
                          {t.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-[11px] text-black/40">{formatDate(t.createdAt)}</p>
                    {(t.replyCount ?? 0) > 0 && (
                      <span className="mt-1 flex items-center justify-end gap-1 text-[11px] text-black/35">
                        <MessageCircle className="h-3 w-3" />
                        {t.replyCount}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-3 border-t border-black/5 pt-2.5 text-[11px] text-black/40">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    TKT-{t.id.slice(-4).padStart(4, "0")}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {assignedName}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ── detail dialog ── */}
      <Dialog open={!!activeTicket} onOpenChange={(open) => { if (!open) setActiveTicket(null); }}>
        <DialogContent
          className="flex flex-col gap-0 overflow-hidden p-0"
          style={{ maxWidth: 780, height: "85vh" }}
          aria-describedby={undefined}
        >
          {activeTicket && (
            <TicketDetailPanel
              ticket={activeTicket}
              users={users}
              onClose={() => setActiveTicket(null)}
              onAfterDelete={() => setActiveTicket(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

