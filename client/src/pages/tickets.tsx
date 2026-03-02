import { useRole } from "@/hooks/use-role";
import { CommandCenterShell } from "@/components/command-center-shell";
import TicketsBoard from "@/components/tickets-board";

export default function TicketsPage() {
  const { role, setRole } = useRole();

  return (
    <CommandCenterShell
      active="tickets"
      title="Tickets"
      subtitle="Support tickets and tasks"
      role={role}
      onRoleChange={setRole}
    >
      <TicketsBoard />
    </CommandCenterShell>
  );
}
