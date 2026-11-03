import { useState } from "react";
import { useLocation } from "wouter";
import { Building2, Ellipsis, Link as LinkIcon, SquarePen, Trash2, Unlink } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { ICON_BUTTON } from "@/features/pipeline/shared/button-styles";
import { useDeleteTicket, useUpdateTicket } from "../../api/use-ticket-mutations";
import { ticketErrorMessage } from "../../lib/error-message";
import { cleanClientName } from "../../lib/ticket-display";
import type { Ticket } from "../../types";
import { DeleteTicketDialog } from "../dialogs/delete-ticket-dialog";
import { LinkHolidayDialog } from "../dialogs/link-holiday-dialog";

export interface TicketMoreMenuProps {
  ticket: Ticket;
  /** Opens the new-ticket dialog prefilled with this ticket's client. */
  onNewForClient: () => void;
  /** Lets the page open the link dialog from its own buttons. */
  linkOpen: boolean;
  onLinkOpenChange: (open: boolean) => void;
}

/** The "···" menu: copy link, link / change / unlink holiday, new ticket for the client, delete. */
export function TicketMoreMenu({ ticket, onNewForClient, linkOpen, onLinkOpenChange }: TicketMoreMenuProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const first = cleanClientName(ticket.clientName)?.split(" ")[0];

  const copyLink = () => {
    const url = `${window.location.origin}/tickets/${ticket.id}`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast({ title: "Link copied", description: url }))
      .catch(() => toast({ title: "Couldn't copy link", variant: "destructive" }));
  };

  const unlink = () =>
    updateTicket.mutate(
      { id: ticket.id, data: { transactionId: null } },
      {
        onSuccess: () => toast({ title: "Holiday unlinked" }),
        onError: (err) => toast({ title: ticketErrorMessage(err, "Failed to unlink holiday"), variant: "destructive" }),
      },
    );

  const confirmDelete = () =>
    deleteTicket.mutate(ticket.id, {
      onSuccess: () => {
        toast({ title: "Ticket deleted" });
        setDeleteOpen(false);
        navigate("/tickets");
      },
      onError: (err) => toast({ title: ticketErrorMessage(err, "Failed to delete ticket"), variant: "destructive" }),
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={ICON_BUTTON} aria-label="More actions" title="More actions" data-testid="ticket-thread-more">
            <Ellipsis className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 rounded-xl">
          <DropdownMenuItem onClick={copyLink} className="gap-2 rounded-lg text-sm" data-testid="ticket-copy-link">
            <LinkIcon className="h-4 w-4" /> Copy link to ticket
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onLinkOpenChange(true)} disabled={!ticket.clientId} className="gap-2 rounded-lg text-sm" data-testid="ticket-link-booking">
            <Building2 className="h-4 w-4" /> {ticket.transactionId ? "Change holiday" : "Link to holiday"}
          </DropdownMenuItem>
          {ticket.transactionId && (
            <DropdownMenuItem onClick={unlink} className="gap-2 rounded-lg text-sm" data-testid="ticket-unlink-booking">
              <Unlink className="h-4 w-4" /> Unlink holiday
            </DropdownMenuItem>
          )}
          {ticket.clientId && (
            <DropdownMenuItem onClick={onNewForClient} className="gap-2 rounded-lg text-sm" data-testid="ticket-new-for-client">
              <SquarePen className="h-4 w-4" /> New ticket for {first || "this client"}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="gap-2 rounded-lg text-sm text-red-600 focus:text-red-600 dark:text-red-400"
            data-testid="ticket-delete"
          >
            <Trash2 className="h-4 w-4" /> Delete ticket
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LinkHolidayDialog ticket={ticket} open={linkOpen} onOpenChange={onLinkOpenChange} />
      <DeleteTicketDialog open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={confirmDelete} isDeleting={deleteTicket.isPending} />
    </>
  );
}
