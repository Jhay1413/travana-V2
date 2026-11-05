import type { MouseEvent, KeyboardEvent } from "react";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTicketPin } from "../../api/use-ticket-pin";
import { cleanClientName } from "../../lib/ticket-display";
import type { Ticket } from "../../types";

/**
 * A pin on every queue row / card: muted when not pinned, orange when pinned.
 * Clicking toggles the per-user pin without opening the ticket.
 */
export function TicketPinButton({ ticket, className }: { ticket: Pick<Ticket, "id" | "subject" | "clientName" | "type">; className?: string }) {
  const { isPinned, togglePin } = useTicketPin(ticket.id, { label: ticket.subject, subtitle: cleanClientName(ticket.clientName) ?? ticket.type });
  const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();
  return (
    <button
      type="button"
      aria-label={isPinned ? "Unpin ticket" : "Pin ticket"}
      aria-pressed={isPinned}
      draggable={false}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        togglePin();
      }}
      onKeyDown={stop}
      className={cn("relative z-10 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-social-orange", className)}
      data-testid={`ticket-pin-toggle-${ticket.id}`}
      data-pinned={isPinned ? "true" : "false"}
    >
      <Pin className={cn("h-3 w-3", isPinned ? "fill-social-orange text-social-orange" : "text-social-muted/50 hover:text-social-muted")} />
    </button>
  );
}
