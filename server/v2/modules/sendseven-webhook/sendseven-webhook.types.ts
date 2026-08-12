// Minimal shape of a SendSeven webhook delivery we care about. The full event
// catalogue is in docs/sendseven-ai-auto-reply-plan.md §1.
export interface SsWebhookEvent {
  id?: string;
  event_id?: string;
  type?: string;
  tenant_id?: string;
  created_at?: string;
  data?: {
    message?: {
      id?: string;
      conversation_id?: string;
      channel_id?: string;
      contact_id?: string;
      direction?: "inbound" | "outbound";
      message_type?: string;
      text?: string | null;
      meta?: Record<string, unknown> | null;
    };
    conversation?: Record<string, unknown>;
    contact?: Record<string, unknown>;
    // comment.received — a new comment on a connected IG/FB post.
    comment?: {
      // SendSeven's own id (`sc_…`); absent on some deliveries.
      id?: string;
      // Meta's comment id — the one the private-reply endpoint takes.
      external_id?: string;
      text?: string | null;
      state?: string;
      author?: { username?: string | null; name?: string | null; id?: string | null } | null;
      // Null when SendSeven could not derive a reliable comment timestamp.
      private_reply_window_expires_at?: string | null;
      post_id?: string | null;
      [key: string]: unknown;
    };
    // comment.received — the channel the commented-on post belongs to. Also
    // what `source_filter_mode: "selected"` matches against.
    channel_id?: string;
    // True when a SendSeven auto-reply rule or flow already answered, which
    // permanently spends the comment's single private reply.
    auto_replied?: boolean;
    is_reply?: boolean;
    parent_external_comment_id?: string | null;
  };
}

// Response from POST /webhook-endpoints (WebhookSecretResponse — secret shown once).
export interface SsWebhookEndpointCreated {
  webhook_id: string;
  secret_key: string;
  message?: string;
}

// Why a conversation was handed off to a human (needsHuman=true) — persisted in
// the conversation state's `context` jsonb and read by the reply worker's
// resume gate. Human-owned reasons ("human_reply", "manual_disable") make the
// hand-off STICKY: the AI stays silent until an agent re-enables it from the
// inbox. AI-caused reasons ("ai_wound_down", "enquiry_scheduled") allow the
// idle auto-resume. Rows written before this existed have no reason and are
// treated as "human_reply" (fail safe: stay silent).
export type HandoffReason = "human_reply" | "manual_disable" | "ai_wound_down" | "enquiry_scheduled";

// Per-conversation AI enable/disable/status surface (conversations module's
// ai-state endpoints). `aiActive` is the inverse of `needsHuman` — exposed
// this way so callers don't have to reason about the double-negative.
export interface ConversationAiState {
  aiActive: boolean;
  needsHuman: boolean;
  handledByHumanAt: string | null;
  updatedAt: string | null;
  // Where the effective on/off comes from: an explicit per-conversation agent
  // override, the linked client's aiReplyEnabled flag, or the default (off —
  // no client linked / client not opted in).
  source: "override" | "client" | "default";
  // The linked client's own opt-in flag (false when no client is linked).
  clientAiEnabled: boolean;
}
