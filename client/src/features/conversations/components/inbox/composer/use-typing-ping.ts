import { useCallback, useEffect, useRef } from "react";
import { conversationsApi } from "../../../api/conversations.api";

// How often the composer re-announces that this agent is still typing. The
// server's indicator outlives one ping, so this is about keeping it alive, not
// tracking keystrokes.
const TYPING_PING_MS = 3_000;
// How long a pause counts as "stopped typing". Short enough that the indicator
// disappears about when the agent actually stops, long enough to survive
// thinking mid-sentence.
const TYPING_IDLE_MS = 1_500;

export function useTypingPing(conversationId: string): { pingTyping: () => void; sendTypingStop: () => void } {
  // Presence ping. Throttled to one call per TYPING_PING_MS while the agent is
  // actively typing — the indicator outlives a single ping, so this keeps it
  // alive rather than tracking keystrokes.
  const lastTypingPing = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendTypingStop = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    // Only if we actually announced typing — otherwise this is a pointless
    // request on every thread switch.
    if (!lastTypingPing.current) return;
    lastTypingPing.current = 0;
    void conversationsApi.typing(conversationId, true).catch(() => undefined);
  }, [conversationId]);

  const pingTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingPing.current >= TYPING_PING_MS) {
      lastTypingPing.current = now;
      // Cosmetic: never surface a failure to the agent mid-sentence.
      void conversationsApi.typing(conversationId, false).catch(() => undefined);
    }
    // Pausing is the common way people stop — waiting for the indicator to time
    // out leaves it hanging for seconds after they've clearly finished, so an
    // explicit stop is sent once they go quiet.
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(sendTypingStop, TYPING_IDLE_MS);
  }, [conversationId, sendTypingStop]);

  // Clear the indicator for colleagues when this thread is left mid-draft.
  useEffect(() => sendTypingStop, [sendTypingStop]);

  return { pingTyping, sendTypingStop };
}
