import { useMemo } from "react";
import { useLocation } from "wouter";
import { useTicketsByClient } from "../../api/use-ticket-queries";
import { shortId } from "../../lib/ticket-display";
import { formatRelativeTime } from "@/lib/note-time";
import { PanelSection } from "./panel-parts";
import { StatusDot } from "../shared/status-badge";

const MAX_ROWS = 5;

/** The client's other tickets (newest first, up to five), each linking to its page. */
export function PastTickets({ clientId, currentTicketId }: { clientId: string; currentTicketId: string }) {
  const [, navigate] = useLocation();
  const { data } = useTicketsByClient(clientId);
  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((t) => t.id !== currentTicketId)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, MAX_ROWS),
    [data, currentTicketId],
  );
  if (rows.length === 0) return null;
  return (
    <PanelSection title="Past tickets">
      <div className="flex flex-col gap-1" data-testid="ticket-past-tickets">
        {rows.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate(`/tickets/${t.id}`)}
            className="flex items-center gap-2.5 rounded-lg py-1 text-left text-[13px] hover:bg-muted/60"
            data-testid={`ticket-past-${t.id}`}
          >
            <StatusDot status={t.status} />
            <span className="font-medium text-social-muted">#{shortId(t.id)}</span>
            <span className="min-w-0 flex-1 truncate">{t.subject}</span>
            <span className="whitespace-nowrap text-[12px] text-social-muted">{formatRelativeTime(t.createdAt)}</span>
          </button>
        ))}
      </div>
    </PanelSection>
  );
}
