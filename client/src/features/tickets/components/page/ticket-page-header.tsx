import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, ChevronDown, ChevronUp, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { useUpdateTicket } from "../../api/use-ticket-mutations";
import { useTicketPin } from "../../api/use-ticket-pin";
import { ticketErrorMessage } from "../../lib/error-message";
import { cleanClientName, shortId } from "../../lib/ticket-display";
import type { PrevNext } from "../../lib/ticket-nav";
import { isActiveTicket } from "../../lib/ticket-filters";
import type { Ticket } from "../../types";
import { TicketMoreMenu, type TicketMoreMenuProps } from "./ticket-more-menu";

const SQUARE = "grid h-[34px] w-[34px] place-items-center rounded-[8px] border border-social-border bg-card text-social-muted transition hover:bg-muted hover:text-foreground disabled:opacity-40";

/** Desktop page header: back, breadcrumb, "i of n" with prev / next, pin, resolve / reopen and the More menu. */
export function TicketPageHeader({ ticket, nav, menu }: { ticket: Ticket; nav: PrevNext; menu: Omit<TicketMoreMenuProps, "ticket"> }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const updateTicket = useUpdateTicket();
  const client = cleanClientName(ticket.clientName);
  const { isPinned, togglePin } = useTicketPin(ticket.id, { label: ticket.subject, subtitle: client ?? ticket.type });
  const active = isActiveTicket(ticket);

  const setStatus = (status: string, done: string, onDone?: () => void) =>
    updateTicket.mutate(
      { id: ticket.id, data: { status } },
      {
        onSuccess: () => {
          toast({ title: done });
          onDone?.();
        },
        onError: (err) => toast({ title: ticketErrorMessage(err, "Failed to update status"), variant: "destructive" }),
      },
    );

  return (
    <div className="flex h-[38px] flex-none items-center gap-3" data-testid="ticket-page-header">
      <button type="button" onClick={() => navigate("/tickets")} className={cn(SQUARE, "h-[38px] w-[38px]")} aria-label="Back to tickets" data-testid="ticket-back">
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-2 text-[14px]">
        <Link href="/tickets" className="font-medium hover:underline">Tickets</Link>
        <span className="text-social-muted/50">/</span>
        <span className="font-semibold">#{shortId(ticket.id)}</span>
      </div>
      <span className="flex-1" />
      {nav.index >= 0 && (
        <>
          <span className="text-[12px] text-social-muted" data-testid="ticket-position">{nav.index + 1} of {nav.total}</span>
          <button type="button" className={SQUARE} aria-label="Previous ticket" disabled={!nav.prevId} onClick={() => nav.prevId && navigate(`/tickets/${nav.prevId}`)} data-testid="ticket-prev">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" className={SQUARE} aria-label="Next ticket" disabled={!nav.nextId} onClick={() => nav.nextId && navigate(`/tickets/${nav.nextId}`)} data-testid="ticket-next">
            <ChevronDown className="h-4 w-4" />
          </button>
        </>
      )}
      <Button
        type="button"
        variant="outline"
        className={cn(OUTLINE_ACTION, "h-[38px] px-3.5", isPinned && "border-social-orange bg-ticket-amber-bg text-ticket-amber-fg hover:bg-ticket-amber-bg")}
        onClick={togglePin}
        data-testid="ticket-pin"
      >
        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        {isPinned ? "Pinned" : "Pin"}
      </Button>
      {active ? (
        <Button
          type="button"
          className="h-[38px] gap-2 rounded-[10px] bg-status-scheduled-fg px-[18px] text-[13px] font-semibold text-white hover:bg-status-scheduled-fg/90"
          onClick={() => setStatus("Resolved", "Ticket marked as resolved", () => navigate("/tickets"))}
          disabled={updateTicket.isPending}
          data-testid="ticket-resolve"
        >
          <Check className="h-4 w-4" strokeWidth={2.4} />
          Mark resolved
        </Button>
      ) : (
        <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-[38px] px-[18px]")} onClick={() => setStatus("Open", "Ticket reopened")} disabled={updateTicket.isPending} data-testid="ticket-reopen">
          Reopen
        </Button>
      )}
      <TicketMoreMenu ticket={ticket} {...menu} />
    </div>
  );
}
