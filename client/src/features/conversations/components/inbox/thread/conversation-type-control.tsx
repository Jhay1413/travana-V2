import { BadgePoundSterling, Check, ChevronDown, ShieldCheck, Tag, X as XIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useUpdateConversation } from "../../../api/use-conversations-mutations";
import type { Conversation } from "../../../types";

const CONVERSATION_TYPE_LABELS: Record<"sales" | "admin", string> = { sales: "Sales", admin: "Admin" };

// Chip for classifying the conversation. Persisted on our side
// (sendseven_conversation_state.conversation_type) via the same PATCH the other
// local fields use; the list row reads it back.
export function ConversationTypeControl({ conversation }: { conversation: Conversation }) {
  const { toast } = useToast();
  const update = useUpdateConversation();
  const current = conversation.conversationType ?? null;
  const Icon = current === "sales" ? BadgePoundSterling : current === "admin" ? ShieldCheck : Tag;

  const setType = (type: "sales" | "admin" | null) =>
    update.mutate(
      { id: conversation.id, body: { conversation_type: type } },
      {
        onSuccess: () =>
          toast({
            title: type ? `Marked as ${CONVERSATION_TYPE_LABELS[type]}` : "Type cleared",
            description: type ? "Shown under the contact's name in the inbox list." : undefined,
          }),
        onError: (err) => {
          const e = err as { response?: { data?: { message?: string } }; message?: string };
          toast({ title: "Could not update type", description: e?.response?.data?.message ?? e?.message, variant: "destructive" });
        },
      },
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-[34px] items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition",
            current
              ? "bg-black/[0.05] text-black/70 hover:bg-black/10 dark:bg-white/10 dark:text-white/80"
              : "border border-dashed border-black/20 text-black/45 hover:text-black dark:border-white/20 dark:text-white/45",
          )}
          title="Conversation type"
          data-testid="conversation-type"
        >
          <Icon className="h-3.5 w-3.5" />
          {current ? CONVERSATION_TYPE_LABELS[current] : "Set type"}
          <ChevronDown className="h-3 w-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="rounded-xl">
        <DropdownMenuItem onClick={() => setType("sales")} className="gap-2 rounded-lg text-sm" data-testid="conversation-type-sales">
          <BadgePoundSterling className="h-4 w-4" /> Sales {current === "sales" && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setType("admin")} className="gap-2 rounded-lg text-sm" data-testid="conversation-type-admin">
          <ShieldCheck className="h-4 w-4" /> Admin {current === "admin" && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
        {current && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setType(null)} className="gap-2 rounded-lg text-sm" data-testid="conversation-type-clear">
              <XIcon className="h-4 w-4" /> Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
