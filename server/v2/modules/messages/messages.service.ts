import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";
import { conversationsService } from "../conversations/conversations.service";
import { userRepository } from "../user/user.repository";
import { realtimeService } from "../../realtime/realtime.service";
import { messagesRepository } from "./messages.repository";
import { inboxNoteAuthorRepository, type InboxNoteAuthorRow } from "./inbox-note-author.repository";
import { usageService } from "../usage/usage.service";
import type { ListMessagesParams, SsMessage, SsMessageList } from "./messages.types";

// Stamp WHO sent a message on its free-form meta so the thread can show the
// agent's name/avatar (AI replies carry source "travana-ai" from the reply
// worker; staff replies and internal notes get "travana-agent" here).
// SendSeven stores and echoes meta back on reads. Best-effort: a lookup failure
// returns the body unchanged.
function displayName(u: { firstName?: string | null; lastName?: string | null; name: string }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.name;
}

function isInternal(m: SsMessage): boolean {
  const meta = m.meta as Record<string, unknown> | null | undefined;
  return m.is_internal === true || meta?.is_internal_note === true;
}

// SendSeven's note id: `meta.note_id` on thread messages, or a top-level
// `note_id` on some responses.
function noteIdOf(m: SsMessage): string | null {
  const meta = m.meta as Record<string, unknown> | null | undefined;
  const id = meta?.note_id ?? m.note_id;
  return typeof id === "string" && id ? id : null;
}

// SendSeven discards our meta on notes, so authorship is read back from our own
// inbox_note_authors table and re-stamped in the shape the client already reads.
// Best-effort: a lookup failure returns the messages unchanged.
async function attachNoteAuthors(orgId: string, items: SsMessage[]): Promise<SsMessage[]> {
  const notes = items.filter(isInternal);
  const ids = notes.flatMap((m) => [m.id, noteIdOf(m)].filter((id): id is string => !!id));
  if (!orgId || ids.length === 0) return items;
  let rows: InboxNoteAuthorRow[];
  try {
    rows = await inboxNoteAuthorRepository.findByMessageIds(orgId, ids);
  } catch (err) {
    console.warn("[messages] could not load internal note authors:", err);
    return items;
  }
  // A stored row may be keyed by the message id or the note id (whichever the
  // create response carried), so index it under both.
  const byId = new Map<string, InboxNoteAuthorRow>();
  for (const r of rows) {
    byId.set(r.sendsevenMessageId, r);
    if (r.sendsevenNoteId) byId.set(r.sendsevenNoteId, r);
  }
  return items.map((m) => {
    const noteId = noteIdOf(m);
    const author = isInternal(m) ? byId.get(m.id) ?? (noteId ? byId.get(noteId) : undefined) : undefined;
    if (!author) return m;
    return {
      ...m,
      meta: {
        ...((m.meta as Record<string, unknown> | null | undefined) ?? {}),
        source: "travana-agent",
        agent: { id: author.userId, name: displayName(author), avatar: author.image ?? null },
      },
    };
  });
}

async function stampSender(body: Record<string, unknown>, senderUserId?: string | null): Promise<Record<string, unknown>> {
  if (!senderUserId) return body;
  try {
    const sender = await userRepository.findById(senderUserId);
    if (!sender) return body;
    const name = displayName(sender);
    return {
      ...body,
      meta: {
        ...((body.meta as Record<string, unknown> | undefined) ?? {}),
        source: "travana-agent",
        agent: { id: sender.id, name, avatar: sender.image ?? null },
      },
    };
  } catch (err) {
    console.warn("[messages] could not stamp sender on outbound message:", err);
    return body;
  }
}

// Thin orchestration over the repository. SendSeven owns message state; we proxy.

export const messagesService = {
  async list(orgId: string, params: ListMessagesParams): Promise<SsMessageList> {
    const page = await messagesRepository.list(params);
    return { ...page, items: await attachNoteAuthors(orgId, page.items) };
  },
  async getById(orgId: string, id: string): Promise<SsMessage> {
    const message = await messagesRepository.getById(id);
    const [enriched] = await attachNoteAuthors(orgId, [message]);
    return enriched ?? message;
  },

  // A reply sent from OUR inbox is always staff-authored (the AI sends its own
  // replies via reply-worker's messagesRepository.send() call directly, tagged
  // with AI_META, never through this HTTP path) — so every successful send
  // here pauses the AI on that conversation synchronously, instead of relying
  // solely on the message.sent webhook echo (sendseven-webhook.service.ts
  // process()), which remains the backstop for replies sent directly in
  // SendSeven's own UI. Best-effort: a state-write failure must never fail
  // (or appear to fail) the send the user is waiting on.
  async send(orgId: string, body: Record<string, unknown>, senderUserId?: string | null): Promise<SsMessage> {
    body = await stampSender(body, senderUserId);
    const sent = await messagesRepository.send(body);
    if (orgId) {
      void usageService.recordSendsevenSend({ orgId, source: "manual" });
    }
    const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : sent.conversation_id;
    if (orgId && conversationId && senderUserId) {
      // Auto-claim: replying to an unassigned conversation assigns it to the
      // replier. Fire-and-forget — the method itself never throws.
      void conversationsService.autoAssignReplier(orgId, conversationId, senderUserId);
    }
    if (orgId && conversationId) {
      try {
        realtimeService.publish(orgId, { type: "message.sent", conversationId });
      } catch (err) {
        console.warn(`[messages] realtime publish failed for conv ${conversationId} after staff reply:`, err);
      }
      try {
        // Also publishes ai-state.changed (needsHuman: true) — see
        // sendseven-webhook.service.ts pauseAiForStaffReply, the single
        // choke point that covers every caller of this pause.
        await sendsevenWebhookService.pauseAiForStaffReply(orgId, conversationId);
      } catch (err) {
        console.warn(`[messages] failed to pause AI for conv ${conversationId} after staff reply:`, err);
      }
    }
    return sent;
  },

  // Internal notes never reach the customer, but the other agents' open thread
  // should still show them live — reuse message.sent since the client reacts to
  // it by refetching exactly what a note changes (thread + list preview).
  async createInternalNote(orgId: string, body: Record<string, unknown>, senderUserId?: string | null): Promise<SsMessage> {
    // No meta stamp: SendSeven replaces note meta, so authorship is stored locally instead.
    const created = await messagesRepository.createInternalNote(body);
    const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : created.conversation_id;
    if (orgId && senderUserId && created.id) {
      try {
        await inboxNoteAuthorRepository.create({
          orgId,
          sendsevenMessageId: created.id,
          sendsevenNoteId: noteIdOf(created),
          conversationId: conversationId ?? "",
          userId: senderUserId,
        });
      } catch (err) {
        console.warn(`[messages] could not record author for internal note ${created.id}:`, err);
      }
    }
    if (orgId && conversationId) {
      try {
        realtimeService.publish(orgId, { type: "message.sent", conversationId });
      } catch (err) {
        console.warn(`[messages] realtime publish failed for conv ${conversationId} after internal note:`, err);
      }
    }
    return created;
  },
  mentionUsers: () => messagesRepository.mentionUsers(),
  react: (id: string, body: unknown) => messagesRepository.react(id, body),
  removeReaction: (id: string, body: unknown) => messagesRepository.removeReaction(id, body),
  translate: (id: string, body: unknown) => messagesRepository.translate(id, body),
  downloadAttachment: (attachmentId: string) => messagesRepository.downloadAttachment(attachmentId),
  uploadAttachment: (file: { buffer: Buffer; filename: string; contentType: string }) =>
    messagesRepository.uploadAttachment(file),
};
