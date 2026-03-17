import { useRole } from "@/hooks/use-role";
import { useParams } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import TicketsBoard from "@/components/tickets-board";

export default function TicketsPage() {
  const { role, setRole } = useRole();
  const params = useParams<{ ticketId?: string }>();

  return (
    <CommandCenterShell
      active="tickets"
      title="Tickets"
      subtitle="Support tickets and tasks"
      role={role}
      onRoleChange={setRole}
    >
      <TicketsBoard selectedTicketId={params.ticketId} />
    </CommandCenterShell>
  );
}
