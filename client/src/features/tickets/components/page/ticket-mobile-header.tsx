import { useLocation } from "wouter";
import { ArrowLeft, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useUpdateTicket } from "../../api/use-ticket-mutations";
import { ticketErrorMessage } from "../../lib/error-message";
import { isActiveTicket } from "../../lib/ticket-filters";
import { shortId } from "../../lib/ticket-display";
import type { Ticket } from "../../types";
import { DuePill } from "../shared/due-pill";
import { TicketMoreMenu, type TicketMoreMenuProps } from "./ticket-more-menu";
import { TicketFieldSelects } from "./ticket-field-selects";
import type { User as ApiUser } from "@/features/user/types";

const SQUARE = "grid h-9 w-9 place-items-center rounded-[8px] border border-social-border bg-card text-social-muted";

/** ≤900px header: back, id and subject, call, More; then the field selects and a resolve button. */
export function TicketMobileHeader({ ticket, users, now, menu }: { ticket: Ticket; users: ApiUser[]; now: Date; menu: Omit<TicketMoreMenuProps, "ticket"> }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const updateTicket = useUpdateTicket();
  const active = isActiveTicket(ticket);
  const phone = ticket.clientPhone?.trim();

  const toggleResolved = () =>
    updateTicket.mutate(
      { id: ticket.id, data: { status: active ? "Resolved" : "Open" } },
      {
        onSuccess: () => {
          toast({ title: active ? "Ticket marked as resolved" : "Ticket reopened" });
          if (active) navigate("/tickets");
        },
        onError: (err) => toast({ title: ticketErrorMessage(err, "Failed to update status"), variant: "destructive" }),
      },
    );

  return (
    <div className="flex flex-none flex-col gap-2.5" data-testid="ticket-mobile-header">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => navigate("/tickets")} className={SQUARE} aria-label="Back to tickets">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">#{shortId(ticket.id)}</div>
          <div className="truncate text-[12px] text-social-muted">{ticket.subject}</div>
        </div>
        {phone && (
          <a href={`tel:${phone.replace(/\s/g, "")}`} className={SQUARE} aria-label="Call client">
            <Phone className="h-4 w-4" />
          </a>
        )}
        <TicketMoreMenu ticket={ticket} {...menu} />
      </div>
      <div className="flex items-center gap-2">
        <DuePill ticket={ticket} now={now} />
        <span className="flex-1" />
        <Button type="button" variant="outline" className="h-9 rounded-[10px] border-social-border bg-card text-[13px]" onClick={toggleResolved} disabled={updateTicket.isPending}>
          {active ? "Mark resolved" : "Reopen"}
        </Button>
      </div>
      <TicketFieldSelects ticket={ticket} users={users} />
    </div>
  );
}
