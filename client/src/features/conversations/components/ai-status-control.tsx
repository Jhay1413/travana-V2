import { Bot, BotOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useConversationAiState } from "../api/use-conversations-queries";
import { useEnableConversationAi, useDisableConversationAi } from "../api/use-conversations-mutations";

// Thread-header badge + toggle for the per-conversation AI auto-reply state.
// The server pauses AI automatically once a human sends a reply; this lets an
// agent resume it (or pause it proactively) from the conversation header.
export function AiStatusControl({ conversationId }: { conversationId: string }) {
  const { toast } = useToast();
  const { data: aiState, isLoading } = useConversationAiState(conversationId);
  const enableAi = useEnableConversationAi();
  const disableAi = useDisableConversationAi();

  const pending = enableAi.isPending || disableAi.isPending;

  const onToggle = () => {
    if (!aiState) return;
    if (aiState.aiActive) {
      disableAi.mutate(conversationId, {
        onError: (err) =>
          toast({ title: "Couldn't pause AI", description: (err as Error).message, variant: "destructive" }),
      });
    } else {
      enableAi.mutate(conversationId, {
        onError: (err) =>
          toast({ title: "Couldn't resume AI", description: (err as Error).message, variant: "destructive" }),
      });
    }
  };

  if (isLoading || !aiState) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-black/30 dark:bg-white/[0.06] dark:text-white/30">
        <Loader2 className="h-3 w-3 animate-spin" /> AI status
      </span>
    );
  }

  const isActive = aiState.aiActive;
  // Distinguish "paused because an agent is handling it" (was on, human took
  // over) from plain "off" (default — not opted in, or explicitly disabled).
  const statusLabel = isActive
    ? aiState.source === "client"
      ? "AI active — client opt-in"
      : "AI active"
    : aiState.needsHuman && aiState.source !== "default"
      ? "AI paused — agent handling"
      : "AI off";

  return (
    <div className="flex items-center gap-1.5" data-testid="conversation-ai-status">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
          isActive
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        )}
        data-testid="conversation-ai-status-badge"
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-emerald-500" : "bg-amber-500")} />
        {statusLabel}
      </span>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        title={isActive ? "Turn the AI off for this conversation" : "Turn the AI on for this conversation (overrides the client default)"}
        className="flex items-center gap-1.5 rounded-xl border border-black/8 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/8 dark:text-white/70 dark:hover:bg-white/[0.04]"
        data-testid="conversation-ai-status-toggle"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isActive ? (
          <BotOff className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
        {isActive ? "Turn off AI" : "Turn on AI"}
      </button>
    </div>
  );
}
