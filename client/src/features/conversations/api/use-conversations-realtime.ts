import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { conversationsKeys } from "./use-conversations-queries";
import { messagesKeys } from "./use-messages";

// Server: server/v2/realtime/realtime.routes.ts (not touched here — see
// docs/realtime-inbox-sse-plan.md). Module-local base constant, mirroring the
// `BASE` convention in conversations.api.ts, so the URL isn't hardcoded inline.
const REALTIME_STREAM_URL = "/api/v2/realtime/stream";

// Coalesce bursts of message.* events for the same tab into one invalidation
// pass (pulled forward from Phase 5 — trivial to add here).
const MESSAGE_DEBOUNCE_MS = 250;

// While disconnected (and the tab is visible), fall back to a slow poll so the
// inbox still recovers from an extended outage without waiting on the
// browser's native EventSource reconnect. This is a correctness net, not the
// primary delivery path — EventSource reconnects on its own and no manual
// backoff is added.
const FALLBACK_POLL_MS = 45_000;

const REALTIME_EVENT_TYPES = [
  "message.received",
  "message.sent",
  "conversation.updated",
  "ai-state.changed",
] as const;

interface RealtimeEventPayload {
  type: (typeof REALTIME_EVENT_TYPES)[number];
  conversationId: string;
  needsHuman?: boolean;
}

function parsePayload(raw: string): RealtimeEventPayload | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === "object" &&
      value !== null &&
      "conversationId" in value &&
      typeof (value as { conversationId: unknown }).conversationId === "string"
    ) {
      return value as RealtimeEventPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export interface ConversationsRealtimeOptions {
  /**
   * Fired once per debounce window with the conversations that received INBOUND
   * messages (never the ones we sent ourselves). Coalesced deliberately: a burst
   * of ten messages produces one call with the affected ids, not ten calls.
   */
  onMessagesReceived?: (conversationIds: string[]) => void;
}

// Opens ONE shared EventSource and maps the server's thin SSE events to
// targeted TanStack Query invalidations (see docs/realtime-inbox-sse-plan.md,
// Phase 3). Mount exactly once per app — ConversationsRealtimeProvider does
// this at the layout root; other components read the state from that context
// rather than calling this hook again, which would open a second stream.
export function useConversationsRealtime(options: ConversationsRealtimeOptions = {}) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(false);

  const pendingConversationIds = useRef<Set<string>>(new Set());
  // Tracked apart from `pendingConversationIds` so the notify callback only
  // hears about inbound traffic — invalidation still needs both directions.
  const receivedConversationIds = useRef<Set<string>>(new Set());
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Held in a ref so a caller passing an inline arrow doesn't re-run the effect
  // that owns the EventSource on every render.
  const onMessagesReceivedRef = useRef(options.onMessagesReceived);
  useEffect(() => {
    onMessagesReceivedRef.current = options.onMessagesReceived;
  }, [options.onMessagesReceived]);

  const flushMessageInvalidations = useCallback(() => {
    debounceTimer.current = null;
    const ids = pendingConversationIds.current;
    pendingConversationIds.current = new Set();
    const received = receivedConversationIds.current;
    receivedConversationIds.current = new Set();
    for (const conversationId of ids) {
      qc.invalidateQueries({ queryKey: messagesKeys.list(conversationId) });
      qc.invalidateQueries({ queryKey: conversationsKeys.detail(conversationId) });
    }
    // A new message changes last_message / preview / ordering / badges.
    qc.invalidateQueries({ queryKey: conversationsKeys.all });
    if (received.size > 0) onMessagesReceivedRef.current?.(Array.from(received));
  }, [qc]);

  const scheduleMessageInvalidation = useCallback(
    (conversationId: string, direction: "received" | "sent") => {
      pendingConversationIds.current.add(conversationId);
      if (direction === "received") receivedConversationIds.current.add(conversationId);
      if (debounceTimer.current) return;
      debounceTimer.current = setTimeout(flushMessageInvalidations, MESSAGE_DEBOUNCE_MS);
    },
    [flushMessageInvalidations],
  );

  // Broad resync used on (re)connect — no Last-Event-ID replay in v1, REST is
  // the recovery path (per plan decision #3).
  const resync = useCallback(() => {
    qc.invalidateQueries({ queryKey: conversationsKeys.all });
    qc.invalidateQueries({ queryKey: messagesKeys.all });
  }, [qc]);

  useEffect(() => {
    let source: EventSource | null = null;

    const open = () => {
      source = new EventSource(REALTIME_STREAM_URL, { withCredentials: true });

      source.onopen = () => {
        setConnected(true);
        resync();
      };
      // EventSource auto-reconnects natively on error — just reflect the
      // disconnected state so the fallback poll kicks in; no manual retry.
      source.onerror = () => {
        setConnected(false);
      };

      source.addEventListener("message.received", (raw: MessageEvent) => {
        const payload = parsePayload(raw.data);
        if (payload) scheduleMessageInvalidation(payload.conversationId, "received");
      });
      source.addEventListener("message.sent", (raw: MessageEvent) => {
        const payload = parsePayload(raw.data);
        if (payload) scheduleMessageInvalidation(payload.conversationId, "sent");
      });
      source.addEventListener("conversation.updated", (raw: MessageEvent) => {
        const payload = parsePayload(raw.data);
        if (!payload) return;
        qc.invalidateQueries({ queryKey: conversationsKeys.detail(payload.conversationId) });
        qc.invalidateQueries({ queryKey: conversationsKeys.all });
      });
      source.addEventListener("ai-state.changed", (raw: MessageEvent) => {
        const payload = parsePayload(raw.data);
        if (!payload) return;
        qc.invalidateQueries({ queryKey: conversationsKeys.aiState(payload.conversationId) });
      });
    };

    const close = () => {
      source?.close();
      source = null;
      setConnected(false);
    };

    // Visibility handling: close the stream in background tabs, reopen (with
    // a fresh resync via onopen) when the tab becomes visible again.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        close();
      } else if (!source) {
        open();
      }
    };

    if (!document.hidden) open();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      close();
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
    };
  }, [qc, resync, scheduleMessageInvalidation]);

  // Fallback poll: only while disconnected and the tab is visible. Chosen
  // over a `refetchInterval` prop on individual queries because a single
  // interval here can reuse the exact same coalesced `resync()` invalidation
  // as the reconnect path, without threading a `connected` flag through every
  // `useConversations`/`useMessages` call site in the inbox.
  useEffect(() => {
    if (connected) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      resync();
    }, FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [connected, resync]);

  return { connected };
}
