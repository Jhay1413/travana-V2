// Local types mirroring server/v2/modules/internal-chat (internal-chat.types.ts,
// internal-chat.service.ts). Kept feature-local per the client structure rules.

export type ChatMode = "assistant" | "test_flow";

export type ChatMessageRole = "user" | "assistant" | "system_note";

// Shape of a row from the `internal_chat_message` table (shared/schema.ts),
// as returned by GET/POST .../messages (dates arrive as ISO strings over JSON).
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
}

// POST /api/v2/internal-chat/sessions response `data` (after the axios
// response interceptor unwraps `{ success, message, data }`).
export interface CreateSessionResponse {
  sessionId: string;
}

// POST /api/v2/internal-chat/sessions/:id/messages either returns the
// persisted assistant message (200) or, for a `test_flow` session (not wired
// up yet server-side), a 501 `{ success: false, reply }` — surfaced here as a
// distinct result kind rather than a thrown error.
export type PostMessageResult =
  | { kind: "assistant_reply"; message: ChatMessage }
  | { kind: "test_flow_pending"; reply: string };
