import { useParams } from "wouter";
import { TicketsInbox } from "@/features/tickets";

export default function TicketsPage() {
  const params = useParams<{ ticketId?: string }>();

  return (
    <TicketsInbox selectedTicketId={params.ticketId} />
  );
}
