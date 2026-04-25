import { Ticket as TicketIcon } from "lucide-react";
import { ticketTypePill, ticketStatusPill, formatTicketDate, type TicketItem } from "./client-types";

interface ClientTicketsTabProps {
  filteredTickets: TicketItem[];
  getUserName: (userId: string) => string;
}

export function ClientTicketsTab({
  filteredTickets,
  getUserName,
}: ClientTicketsTabProps) {
  return (
    <div className="grid gap-3" data-testid="list-tickets">
      <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-gradient-to-br from-rose-500/[0.05] via-white to-white p-3.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-rose-500/12 text-rose-600">
          <TicketIcon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight text-black/85">Tickets</div>
          <div className="text-[11px] text-black/50">Support &amp; admin tasks for this client</div>
        </div>
      </div>
      {filteredTickets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-black/10 bg-white/40 p-8 text-center">
          <TicketIcon className="mx-auto mb-1.5 h-6 w-6 text-black/15" />
          <div className="text-sm text-black/55">No tickets for this client.</div>
          <p className="text-xs text-black/40 mt-1">Create a ticket from the Tickets page.</p>
        </div>
      ) : (
        filteredTickets.map((t) => (
          <div
            key={t.id}
            className="rounded-3xl border border-black/10 bg-white/75 p-4 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset] transition hover:bg-white"
            data-testid={`card-ticket-wide-${t.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ticketTypePill(t.type)}`}>
                    {t.type}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${ticketStatusPill(t.status)}`}>
                    {t.status}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-black/60">
                    {t.priority}
                  </span>
                </div>
                <div className="text-sm font-semibold truncate" data-testid={`text-ticket-wide-title-${t.id}`}>
                  {t.subject}
                </div>
                {t.description && (
                  <div className="mt-1 text-xs text-black/60 line-clamp-2">{t.description}</div>
                )}
                <div className="mt-2 text-xs text-black/50" data-testid={`text-ticket-wide-meta-${t.id}`}>
                  Assigned to {getUserName(t.userId)} · {formatTicketDate(t.createdAt)}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
