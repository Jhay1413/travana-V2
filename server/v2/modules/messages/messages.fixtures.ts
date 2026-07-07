import { SAMPLE_CONVERSATIONS } from "../conversations/conversations.fixtures";
import type { ListMessagesParams, SsMessage, SsMessageList } from "./messages.types";

// Temporary in-memory message store used ONLY while SendSeven is unconfigured.
// Seeded from each sample conversation's last_message; sends append here so the
// thread + reply flow works end-to-end in the process (resets on restart).

const store = new Map<string, SsMessage[]>();
let seeded = false;
let counter = 0;

function seed() {
  if (seeded) return;
  for (const conv of SAMPLE_CONVERSATIONS) {
    const lm = conv.last_message;
    if (!lm?.text) {
      store.set(conv.id, []);
      continue;
    }
    store.set(conv.id, [
      {
        id: `${conv.id}-m0`,
        conversation_id: conv.id,
        direction: lm.direction === "outbound" ? "outbound" : "inbound",
        message_type: lm.message_type ?? "text",
        status: "delivered",
        text: lm.text,
        created_at: lm.created_at ?? conv.created_at,
        sent_at: lm.created_at ?? conv.created_at,
      },
    ]);
  }
  seeded = true;
}

export function sampleMessagesList(params: ListMessagesParams): SsMessageList {
  seed();
  const convId = params.conversationId ?? "";
  const all = store.get(convId) ?? [];
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 50;
  const page = params.page && params.page > 0 ? params.page : 1;
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);
  return {
    items,
    pagination: {
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
      has_more: page < totalPages,
      next_cursor: null,
      prev_cursor: null,
    },
  };
}

export function sampleSendMessage(body: Record<string, unknown>): SsMessage {
  seed();
  const convId = String(body.conversation_id ?? "");
  const now = new Date().toISOString();
  counter += 1;
  const message: SsMessage = {
    id: `local-${counter}`,
    conversation_id: convId,
    direction: "outbound",
    message_type: (body.message_type as string) ?? "text",
    status: "sent",
    text: (body.text as string) ?? null,
    is_internal: false,
    created_at: now,
    sent_at: now,
  };
  const thread = store.get(convId) ?? [];
  thread.push(message);
  store.set(convId, thread);
  return message;
}

export function sampleCreateInternalNote(body: Record<string, unknown>): SsMessage {
  const note = sampleSendMessage(body);
  note.is_internal = true;
  note.message_type = "system";
  return note;
}
