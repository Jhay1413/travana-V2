import { Check, Filter, Mailbox } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SsInbox } from "../../../api/inboxes.api";

// Inbox icon: the inbox's emoji if it has one, else a dot in its colour;
// null = "All Messages".
export function InboxDot({ inbox }: { inbox: SsInbox | null }) {
  if (!inbox) return <Mailbox className="h-4 w-4 text-black/50 dark:text-white/50" />;
  if (inbox.icon && /\p{Extended_Pictographic}/u.test(inbox.icon)) {
    return <span className="text-sm leading-none">{inbox.icon}</span>;
  }
  return <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: inbox.color || "#94a3b8" }} />;
}

export interface InboxSwitcherProps {
  inboxId: string | null;
  inboxes: SsInbox[];
  activeInbox: SsInbox | null;
  onInboxChange: (id: string | null) => void;
}

/** The inbox filter (All Messages + custom inboxes). */
export function InboxSwitcher({
  inboxId,
  inboxes,
  activeInbox,
  onInboxChange,
}: InboxSwitcherProps) {
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "grid h-8 w-8 place-items-center rounded-md transition hover:bg-black/5 dark:hover:bg-white/10",
              inboxId ? "text-sky-600" : "text-[#7c98b0] dark:text-white/60",
            )}
            title={activeInbox?.name ?? "All Messages"}
            data-testid="conversation-inbox-switcher"
          >
            <Filter className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[60vh] w-56 overflow-y-auto rounded-xl">
          <DropdownMenuItem
            onClick={() => onInboxChange(null)}
            className="flex items-center justify-between gap-2 rounded-lg text-sm"
            data-testid="inbox-option-all"
          >
            <span className="flex items-center gap-2">
              <Mailbox className="h-4 w-4 text-black/50 dark:text-white/50" /> All Messages
            </span>
            {inboxId === null && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
          {inboxes.length > 0 && <DropdownMenuSeparator />}
          {inboxes.map((ib) => (
            <DropdownMenuItem
              key={ib.id}
              onClick={() => onInboxChange(ib.id)}
              className="flex items-center justify-between gap-2 rounded-lg text-sm"
              data-testid={`inbox-option-${ib.id}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <InboxDot inbox={ib} />
                <span className="truncate">{ib.name}</span>
              </span>
              {inboxId === ib.id && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
