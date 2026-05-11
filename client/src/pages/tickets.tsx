import { useParams } from "wouter";
import TicketsBoard from "@/components/boards/tickets-board";

export default function TicketsPage() {
  const params = useParams<{ ticketId?: string }>();

  return (
    <TicketsBoard selectedTicketId={params.ticketId} />
  );
}
