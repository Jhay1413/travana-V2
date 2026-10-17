import type { ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useUsers } from "@/hooks/queries";
import type { User as ApiUser } from "@/features/user/types";
import { useUpdateTicket } from "../../api/use-ticket-mutations";
import { ticketErrorMessage } from "../../lib/error-message";
import { statusMeta } from "../../lib/ticket-display";
import { TICKET_PRIORITIES, TICKET_STATUSES, type Ticket } from "../../types";
import { DueDateTimeField } from "../shared/due-date-time-field";
import { PriorityBadge } from "../shared/priority-badge";
import { StatusBadge } from "../shared/status-badge";

const UNASSIGNED = "__unassigned";
const TRIGGER = "h-[38px] w-full rounded-[10px] border-social-border bg-card text-[13px]";

function Prop({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[.06em] text-social-muted">{label}</div>
      {children}
    </div>
  );
}

/** Status, priority, assignee and reply-due; each change is one PATCH on the ticket. */
export function TicketFieldSelects({ ticket, users: usersProp }: { ticket: Ticket; users?: ApiUser[] }) {
  const { toast } = useToast();
  const { data: fetchedUsers } = useUsers();
  const users = usersProp ?? fetchedUsers ?? [];
  const updateTicket = useUpdateTicket();

  const patch = (data: Partial<Ticket>, success: string, failure: string) =>
    updateTicket.mutate(
      { id: ticket.id, data },
      {
        onSuccess: () => toast({ title: success }),
        onError: (err) => toast({ title: ticketErrorMessage(err, failure), variant: "destructive" }),
      },
    );

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-[1fr_1fr_1.3fr_1.6fr]" data-testid="ticket-field-selects">
      <Prop label="Status">
        <Select value={ticket.status} onValueChange={(status) => patch({ status }, `Status updated to ${status}`, "Failed to update status")}>
          <SelectTrigger className={TRIGGER} data-testid="ticket-status-select">
            <SelectValue>
              <StatusBadge status={ticket.status} className="px-0 py-0" />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s} data-testid={`ticket-status-${statusMeta(s).slug}`}>
                <StatusBadge status={s} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Prop>
      <Prop label="Priority">
        <Select value={ticket.priority} onValueChange={(priority) => patch({ priority }, `Priority set to ${priority}`, "Failed to update priority")}>
          <SelectTrigger className={TRIGGER} data-testid="ticket-priority-select">
            <SelectValue>
              <PriorityBadge priority={ticket.priority} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TICKET_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                <PriorityBadge priority={p} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Prop>
      <Prop label="Assigned to">
        <Select
          value={ticket.assignedTo ?? UNASSIGNED}
          onValueChange={(userId) =>
            userId === UNASSIGNED
              ? patch({ assignedTo: null }, "Ticket unassigned", "Failed to unassign ticket")
              : patch({ assignedTo: userId }, "Ticket reassigned", "Failed to reassign ticket")
          }
        >
          <SelectTrigger className={TRIGGER} data-testid="ticket-reassign">
            <SelectValue placeholder="Unassigned">{ticket.assignedToName || undefined}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value={UNASSIGNED} data-testid="ticket-unassign">Unassigned</SelectItem>
            {users.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-social-muted">No team members found</div>
            ) : (
              users.map((u) => (
                <SelectItem key={u.id} value={u.id} data-testid={`ticket-reassign-${u.id}`}>
                  {u.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </Prop>
      <Prop label="Reply due" className="col-span-2 xl:col-span-1">
        <DueDateTimeField
          value={ticket.dueDate}
          onChange={(dueDate) => patch({ dueDate }, dueDate ? "Reply due updated" : "Reply due cleared", "Failed to update reply due")}
          testIdPrefix="ticket-due"
        />
      </Prop>
    </div>
  );
}
