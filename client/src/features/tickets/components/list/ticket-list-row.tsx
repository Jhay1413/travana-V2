import { Link } from "wouter";
import { Phone, Pin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/note-time";
import { cleanClientName, shortId } from "../../lib/ticket-display";
import type { DuePillModel } from "../../lib/ticket-due";
import type { Ticket } from "../../types";
import { BookingChip } from "../shared/booking-chip";
import { DuePill } from "../shared/due-pill";
import { KindInline } from "../shared/kind-tag";
import { PriorityBadge } from "../shared/priority-badge";
import { StatusBadge } from "../shared/status-badge";
import { Who } from "../shared/who";
import { LIST_GRID_COLS } from "./list-columns";

/**
 * One list row: a plain grid. The subject is a real link whose ::after stretches
 * over the row, so the whole row opens the ticket while the checkbox cell sits
 * above it and is not nested inside the link.
 */
export function TicketListRow({
  ticket,
  now,
  pill,
  pinned,
  picked,
  onPick,
}: {
  ticket: Ticket;
  now: Date;
  pill?: DuePillModel;
  pinned: boolean;
  picked: boolean;
  onPick: () => void;
}) {
  const client = cleanClientName(ticket.clientName);
  return (
    <div
      className={cn(
        "relative grid h-[60px] items-center gap-3.5 border-b border-pipeline-card-border px-[18px] transition-colors focus-within:bg-muted/60 hover:bg-muted/60",
        picked && "bg-ticket-amber-bg/50",
      )}
      style={{ gridTemplateColumns: LIST_GRID_COLS }}
      data-testid={`ticket-row-${ticket.id}`}
    >
      <div className="relative z-10">
        <Checkbox checked={picked} onCheckedChange={onPick} aria-label={`Select ${ticket.subject}`} data-testid={`ticket-pick-${ticket.id}`} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {pinned && (
            <Pin className="h-3 w-3 shrink-0 fill-social-orange text-social-orange" aria-label="Pinned" data-testid={`ticket-row-pinned-${ticket.id}`} />
          )}
          <Link
            href={`/tickets/${ticket.id}`}
            className="truncate text-[14px] font-semibold outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
            data-testid={`ticket-row-subject-${ticket.id}`}
          >
            {ticket.subject}
          </Link>
        </div>
        <div className="mt-px flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-[12px] text-social-muted">
          <span className="font-medium">#{shortId(ticket.id)}</span>
          <span className="text-social-muted/50">·</span>
          <KindInline type={ticket.type} />
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-medium">{client ?? "Internal ticket"}</div>
        {ticket.clientPhone && (
          <div className="flex items-center gap-1.5 text-[12px] text-social-muted">
            <Phone className="h-3 w-3" />
            {ticket.clientPhone}
          </div>
        )}
      </div>
      <div className="min-w-0"><BookingChip ticket={ticket} /></div>
      <div><PriorityBadge priority={ticket.priority} /></div>
      <div><StatusBadge status={ticket.status} /></div>
      <div className="min-w-0"><Who name={ticket.assignedToName} /></div>
      <div><DuePill ticket={ticket} now={now} pill={pill} /></div>
      <div className="whitespace-nowrap text-[12px] text-social-muted">
        {formatRelativeTime(ticket.lastActivityAt ?? ticket.updatedAt ?? ticket.createdAt)}
      </div>
    </div>
  );
}
