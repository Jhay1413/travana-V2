import { useRole } from "@/hooks/use-role";
import { useParams } from "wouter";
import TicketsBoard from "@/components/tickets-board";

export default function TicketsPage() {
  const { role, setRole } = useRole();
  const params = useParams<{ ticketId?: string }>();

  return (
    <TicketsBoard selectedTicketId={params.ticketId} />
  );
}
