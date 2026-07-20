// Thin real-time event contract — no message content, no PII. Clients respond
// by invalidating the matching TanStack queries and re-fetching through the
// existing org-scoped REST endpoints (SendSeven stays the single source of
// truth for content).
export type RealtimeEventType =
  | "message.received"
  | "message.sent"
  | "conversation.updated"
  | "ai-state.changed";

export interface RealtimeEvent {
  type: RealtimeEventType;
  conversationId: string;
  // Only set on ai-state.changed — drives the AI badge live.
  needsHuman?: boolean;
}
