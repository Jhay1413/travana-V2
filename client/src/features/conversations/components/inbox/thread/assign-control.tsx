import { ChevronDown, User, UserPlus, X as XIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Conversation } from "../../../types";
import { initials } from "../../message-thread";

export interface AssignControlProps {
  conversation: Conversation;
  currentUser: { id: string; name: string } | null;
  staff: { id: string; name: string }[];
  staffLoading?: boolean;
  /** null unassigns. The owner performs the mutation (and the optimistic overlay). */
  onAssign(userId: string | null): void;
}

// Assignment is PLATFORM data (stored in our DB and overlaid onto the proxied
// conversation payload server-side) — SendSeven is not involved, so no
// per-agent SendSeven account is needed.
export function AssignControl({ conversation, currentUser, staff, staffLoading, onAssign }: AssignControlProps) {
  const me = currentUser ? staff.find((m) => m.id === currentUser.id) ?? currentUser : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-[34px] w-[176px] items-center gap-2 rounded-lg border border-social-border bg-card px-2.5 text-[13px] transition hover:bg-muted/50"
          title={conversation.assignee ? `Assigned to ${conversation.assignee}` : "Assign"}
          data-testid="conversation-assign"
        >
          {conversation.assignee ? (
            <span className="relative grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-[9px] font-bold text-white">
              {initials(conversation.assignee)}
            </span>
          ) : (
            <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{conversation.assignee ?? "Unassigned"}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {me && (
          <>
            <DropdownMenuItem onClick={() => onAssign(me.id)} data-testid="conversation-assign-me">
              <User className="mr-1.5 h-3.5 w-3.5" />
              Assign to me
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {staff.length === 0 ? (
          <DropdownMenuItem disabled>{staffLoading ? "Loading team…" : "No team members found"}</DropdownMenuItem>
        ) : (
          staff.map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => onAssign(m.id)} data-testid={`conversation-assign-${m.id}`}>
              <User className="mr-1.5 h-3.5 w-3.5 shrink-0 text-black/40 dark:text-white/40" />
              <span className="truncate">{m.name}</span>
            </DropdownMenuItem>
          ))
        )}
        {conversation.assignee && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onAssign(null)} data-testid="conversation-unassign">
              <XIcon className="mr-1.5 h-3.5 w-3.5" />
              Unassign
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
