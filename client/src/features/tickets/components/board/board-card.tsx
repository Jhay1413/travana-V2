import type { DragEvent } from "react";
import { useLocation } from "wouter";
import { Phone, Pin, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DuePillModel } from "../../lib/ticket-due";
import { cleanClientName, priorityMeta, shortId } from "../../lib/ticket-display";
import type { Ticket } from "../../types";
import { BookingChip } from "../shared/booking-chip";
import { DuePill } from "../shared/due-pill";
import { KindTag } from "../shared/kind-tag";
import { PriorityBadge } from "../shared/priority-badge";
import { Who } from "../shared/who";

export function BoardCard({
  ticket,
  now,
  pill,
  pinned,
  dragging = false,
  draggable = true,
  onDragStart,
  onDragEnd,
}: {
  ticket: Ticket;
  now: Date;
  pill?: DuePillModel;
  pinned: boolean;
  dragging?: boolean;
  /** Mobile has no drag-and-drop. */
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const [, navigate] = useLocation();
  const client = cleanClientName(ticket.clientName);
  const tone = priorityMeta(ticket.priority).tone;
  const open = () => navigate(`/tickets/${ticket.id}`);
  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={ticket.subject}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open();
      }}
      className={cn(
        "flex flex-none flex-col gap-[9px] rounded-[14px] border border-pipeline-card-border bg-card p-[14px] shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-social-orange",
        draggable ? "cursor-grab" : "cursor-pointer",
        dragging && "opacity-45",
      )}
      data-testid={`ticket-card-${ticket.id}`}
    >
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap text-[12px] font-semibold text-social-muted">#{shortId(ticket.id)}</span>
        <KindTag type={ticket.type} />
        {pinned && <Pin className="h-3 w-3 fill-social-orange text-social-orange" aria-label="Pinned" />}
        <span className="flex-1" />
        {(tone === "high" || tone === "urgent") && <PriorityBadge priority={ticket.priority} />}
      </div>
      <div className="line-clamp-2 text-[14.5px] font-semibold leading-[1.35]">{ticket.subject}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13px] font-medium">
          <User className="h-3.5 w-3.5 shrink-0 text-social-muted" />
          <span className="truncate">{client ?? "Internal ticket"}</span>
        </div>
        {ticket.clientPhone && (
          <div className="mt-px flex items-center gap-1.5 text-[12px] text-social-muted">
            <Phone className="h-3 w-3" />
            {ticket.clientPhone}
          </div>
        )}
      </div>
      <BookingChip ticket={ticket} size={30} card />
      <div className="flex items-center gap-2">
        <Who name={ticket.assignedToName} size={24} />
        <span className="flex-1" />
        <DuePill ticket={ticket} now={now} pill={pill} />
      </div>
    </article>
  );
}
