import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { ticketApi } from "../../api/ticket.api";
import { ticketKeys } from "../../api/use-ticket-queries";
import { ticketErrorMessage } from "../../lib/error-message";
import type { DuePillModel } from "../../lib/ticket-due";
import { TICKET_STATUSES, type Ticket, type TicketStatusValue } from "../../types";
import { BoardColumn } from "./board-column";

const sameStatus = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Four status columns; dropping a card on a column moves it at once and PATCHes its status (rolled back on failure). */
export function TicketBoard({
  rows,
  now,
  pills,
  pinned,
  isLoading,
  onAdd,
}: {
  rows: Ticket[];
  now: Date;
  pills: ReadonlyMap<string, DuePillModel>;
  pinned: ReadonlyMap<string, number>;
  isLoading: boolean;
  onAdd: (status: TicketStatusValue) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dragId, setDragId] = useState<string | null>(null);

  const drop = async (id: string, status: TicketStatusValue) => {
    setDragId(null);
    const ticket = rows.find((t) => t.id === id);
    if (!ticket || sameStatus(ticket.status, status)) return;

    // Optimistic: move the card in every cached list, keep a snapshot to roll back to.
    await queryClient.cancelQueries({ queryKey: ticketKeys.lists() });
    const previous = queryClient.getQueriesData<Ticket[]>({ queryKey: ticketKeys.lists() });
    queryClient.setQueriesData<Ticket[]>({ queryKey: ticketKeys.lists() }, (old) =>
      old?.map((t) => (t.id === id ? { ...t, status } : t)),
    );
    try {
      await ticketApi.update(id, { status });
      toast({ title: `Moved to ${status}` });
    } catch (err) {
      previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      toast({ title: ticketErrorMessage(err, "Failed to move ticket"), variant: "destructive" });
    } finally {
      void queryClient.invalidateQueries({ queryKey: ticketKeys.all });
    }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;

  return (
    <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto" data-testid="ticket-board">
      {TICKET_STATUSES.map((status) => (
        <BoardColumn
          key={status}
          status={status}
          tickets={rows.filter((t) => sameStatus(t.status, status))}
          now={now}
          pills={pills}
          pinned={pinned}
          dragId={dragId}
          onDragStart={setDragId}
          onDragEnd={() => setDragId(null)}
          onDropTicket={(id, next) => void drop(id, next)}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}
