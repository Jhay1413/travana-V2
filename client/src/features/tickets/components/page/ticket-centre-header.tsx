import { formatFullDateTime } from "@/lib/note-time";
import type { User as ApiUser } from "@/features/user/types";
import type { Ticket } from "../../types";
import { KindTag } from "../shared/kind-tag";
import { TicketId } from "../shared/ticket-id";
import { TicketFieldSelects } from "./ticket-field-selects";

/** Top of the centre panel: id, kind, created line, the subject, and the four editable fields. */
export function TicketCentreHeader({ ticket, users }: { ticket: Ticket; users: ApiUser[] }) {
  const creator = ticket.userName || users.find((u) => u.id === ticket.userId)?.name || null;
  return (
    <div className="flex-none border-b border-social-border px-5 py-4" data-testid="ticket-centre-header">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <TicketId id={ticket.id} />
        <KindTag type={ticket.type} />
        <span className="min-w-0 truncate text-[12px] text-social-muted" data-testid="ticket-created-line">
          Created {formatFullDateTime(ticket.createdAt)}
          {creator ? ` by ${creator}` : ""}
          {ticket.resolvedAt ? ` · Resolved ${formatFullDateTime(ticket.resolvedAt)}` : ""}
        </span>
      </div>
      <h1 className="mb-3.5 mt-2 text-[20px] font-semibold leading-[1.3] xl:text-[22px]" data-testid="ticket-thread-subject">
        {ticket.subject}
      </h1>
      <TicketFieldSelects ticket={ticket} users={users} />
    </div>
  );
}
