import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { conversationsKeys } from "../api/use-conversations-queries";
import { useConversationsRealtime } from "../api/use-conversations-realtime";
import { ticketKeys } from "@/features/tickets";
import type { SsConversation, SsConversationList } from "../api/conversations.api";

// Owns the single app-wide SSE connection and turns inbound messages into a
// toast, so staff hear about a new message from anywhere in the app rather than
// only while the inbox is open. Mounted once in AppLayout.
//
// The inbox reads `connected` from this context instead of calling
// useConversationsRealtime itself — two callers would mean two EventSource
// connections and duplicated invalidation work.

interface ConversationsRealtimeValue {
  connected: boolean;
}

const ConversationsRealtimeContext = createContext<ConversationsRealtimeValue>({ connected: false });

export function useConversationsRealtimeState(): ConversationsRealtimeValue {
  return useContext(ConversationsRealtimeContext);
}

// The SSE payload carries only a conversation id, so the sender's name is dug
// out of whatever conversation lists are already cached. Returns null when the
// conversation isn't cached yet (first message from a brand-new contact), in
// which case the toast just stays generic rather than guessing.
function cachedContactName(
  conversations: Array<[unknown, SsConversationList | undefined]>,
  conversationId: string,
): string | null {
  for (const [, page] of conversations) {
    const match = page?.items?.find((c: SsConversation) => c.id === conversationId);
    if (!match) continue;
    const contact = (match.contact ?? {}) as Record<string, unknown>;
    for (const key of ["name", "display_name", "full_name"]) {
      const value = contact[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    if (typeof match.subject === "string" && match.subject.trim()) return match.subject.trim();
    return null;
  }
  return null;
}

export function ConversationsRealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleMessagesReceived = useCallback(
    (conversationIds: string[]) => {
      const cached = qc.getQueriesData<SsConversationList>({ queryKey: conversationsKeys.all });
      const names = conversationIds
        .map((id) => cachedContactName(cached, id))
        .filter((name): name is string => !!name);

      const isSingle = conversationIds.length === 1;
      const title = isSingle ? "New message" : `${conversationIds.length} new messages`;
      const description = isSingle
        ? names[0]
          ? `From ${names[0]}`
          : "A contact has replied in the inbox."
        : names.length > 0
          ? `From ${names.slice(0, 3).join(", ")}${names.length > 3 ? " and others" : ""}`
          : "Across several conversations.";

      toast({
        title,
        description,
        action: (
          <ToastAction altText="Open the conversations inbox" onClick={() => navigate("/conversations")}>
            View
          </ToastAction>
        ),
      });
    },
    [qc, toast, navigate],
  );

  // Invalidate the WHOLE ticket tree, not just one list: the sidebar badge reads
  // ticketKeys.byUser(me) while the tickets page reads ticketKeys.list(), and a
  // ticket raised by another agent can land in either. Anything narrower has to
  // guess which cached slices a change belongs to.
  const handleTicketsStale = useCallback(() => {
    qc.invalidateQueries({ queryKey: ticketKeys.all });
  }, [qc]);

  const { connected } = useConversationsRealtime({
    onMessagesReceived: handleMessagesReceived,
    onTicketsStale: handleTicketsStale,
  });
  const value = useMemo(() => ({ connected }), [connected]);

  return (
    <ConversationsRealtimeContext.Provider value={value}>
      {children}
    </ConversationsRealtimeContext.Provider>
  );
}
