// Thin real-time event contract — no message content, no PII. Clients respond
// by invalidating the matching TanStack queries and re-fetching through the
// existing org-scoped REST endpoints (SendSeven stays the single source of
// truth for content).

export type ConversationEventType =
  | "message.received"
  | "message.sent"
  | "conversation.updated"
  | "ai-state.changed";

// One event for the whole ticket lifecycle (created / updated / deleted).
// Clients invalidate every ticket query off it, so splitting it three ways
// would buy nothing but three code paths that must stay in sync.
export type TicketEventType = "ticket.changed";

export type RealtimeEventType = ConversationEventType | TicketEventType;

export interface ConversationRealtimeEvent {
  type: ConversationEventType;
  conversationId: string;
  // Only set on ai-state.changed — drives the AI badge live.
  needsHuman?: boolean;
}

export interface TicketRealtimeEvent {
  type: TicketEventType;
  ticketId: string;
}

// A union, not one interface with optional ids: a ticket event has no
// conversation and must not be able to claim one.
export type RealtimeEvent = ConversationRealtimeEvent | TicketRealtimeEvent;
