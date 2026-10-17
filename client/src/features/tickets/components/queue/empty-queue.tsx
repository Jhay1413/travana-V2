import type { QueueChip } from "../../lib/ticket-queue";

const TEXT: Record<QueueChip, string> = {
  open: "No open tickets match. Clear the search or filters to see more.",
  attention: "Nothing needs attention right now.",
  unassigned: "Every open ticket has an owner.",
  closed: "No resolved or closed tickets match.",
};

export function EmptyQueue({ chip }: { chip: QueueChip }) {
  return (
    <div className="p-8 text-center text-[13px] text-social-muted" data-testid="ticket-empty">
      {TEXT[chip]}
    </div>
  );
}
