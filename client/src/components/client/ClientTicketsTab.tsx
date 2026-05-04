import { Button } from "@/components/ui/button";
import { ticketTypePill, ticketStatusPill, formatTicketDate, type TicketItem } from "./client-types";

interface ClientTicketsTabProps {
  filteredTickets: TicketItem[];
  getUserName: (userId: string) => string;
  onNewTicket: () => void;
}

export function ClientTicketsTab({
  filteredTickets,
  getUserName,
  onNewTicket,
}: ClientTicketsTabProps) {
  return (
    <div className="grid gap-3" data-testid="list-tickets">
      <div className="flex justify-end">
        <Button
          type="button"
          className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
          onClick={onNewTicket}
          data-testid="button-client-ticket-create"
        >
          Create Ticket
        </Button>
      </div>
      {filteredTickets.length === 0 ? (
        <div className="rounded-3xl border border-black/10 bg-white/60 p-6 text-center">
          <div className="text-sm text-black/55">No tickets for this client.</div>
          <p className="mt-1 text-xs text-black/40">Use Create Ticket to open one for this client.</p>
        </div>
      ) : (
        filteredTickets.map((t) => (
          <div
            key={t.id}
            className="rounded-3xl border border-black/10 bg-white/70 p-4"
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
