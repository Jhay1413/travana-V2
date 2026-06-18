import { useParams } from "wouter";
import TicketsBoard from "@/features/social/components/boards/tickets-board";

export default function TicketsPage() {
  const params = useParams<{ ticketId?: string }>();

  return (
    <TicketsBoard selectedTicketId={params.ticketId} />
  );
}
