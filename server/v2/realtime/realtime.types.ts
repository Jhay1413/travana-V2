// Thin real-time event contract — no message content, no PII. Clients respond
// by invalidating the matching TanStack queries and re-fetching through the
// existing org-scoped REST endpoints (SendSeven stays the single source of
// truth for content).

export type ConversationEventType =
  | "message.received"
  | "message.sent"
  | "conversation.updated"
  | "ai-state.changed"
  // Someone is composing a reply — the AI while it generates one, or another
  // agent while they type. Purely presentational and deliberately
  // fire-and-forget: it is never persisted, and a missed event costs nothing
  // because the client expires its own indicator (see TYPING_TTL_MS there).
  | "typing";

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
  // Only set on `typing`. `name` is the agent's display name (staff-to-staff
  // within one org — the AI carries no name), and `userId` lets a client
  // ignore the echo of its own typing.
  typing?: { actor: "ai" | "agent"; name?: string; userId?: string; stopped?: boolean };
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
