import { useParams } from "wouter";
import { TicketPage } from "@/features/tickets";

export default function TicketDetailPage() {
  const { ticketId = "" } = useParams<{ ticketId: string }>();
  return <TicketPage ticketId={ticketId} />;
}
