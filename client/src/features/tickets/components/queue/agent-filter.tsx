import { UserRound } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { AgentOption } from "../../lib/ticket-queue";

const ALL = "__all__";

/** "All agents" or one assignee; the choice is sent to the server, which keeps it inside the caller's own scope. */
export function AgentFilter({ agents, value, onChange }: { agents: AgentOption[]; value: string; onChange: (id: string) => void }) {
  // A saved agent that no longer appears in the options still needs a label.
  const label = value ? (agents.find((a) => a.id === value)?.name ?? "Selected agent") : "All agents";
  return (
    <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
      <SelectTrigger
        className="h-10 w-[160px] gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[12px] font-medium xl:w-[190px] xl:text-[13px]"
        aria-label="Filter by agent"
        data-testid="select-ticket-agent"
      >
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="h-[15px] w-[15px] shrink-0 text-social-muted" />
          <span className="truncate">{label}</span>
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={ALL} className="text-[13px]" data-testid="option-ticket-agent-all">
          All agents
        </SelectItem>
        {agents.map((a) => (
          <SelectItem key={a.id} value={a.id} className="text-[13px]" data-testid={`option-ticket-agent-${a.id}`}>
            {a.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
