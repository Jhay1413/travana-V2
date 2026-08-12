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

// Social comments on Instagram/Facebook posts. `comment.received` is the
// webhook echo; `comment.updated` covers our own triage and private replies so
// a second agent's tab drops the comment out of the unanswered queue live.
export type CommentEventType = "comment.received" | "comment.updated";

export type RealtimeEventType = ConversationEventType | TicketEventType | CommentEventType;

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

export interface CommentRealtimeEvent {
  type: CommentEventType;
  // SendSeven's comment id (`sc_…`) when we know it. On the webhook echo we
  // only have Meta's id, so this is optional — clients refetch the queue
  // rather than patching a single row.
  commentId?: string;
  channelId?: string;
}

// A union, not one interface with optional ids: a ticket event has no
// conversation and must not be able to claim one.
export type RealtimeEvent = ConversationRealtimeEvent | TicketRealtimeEvent | CommentRealtimeEvent;
