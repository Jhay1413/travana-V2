import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";
import { conversationsService } from "../conversations/conversations.service";
import { userRepository } from "../user/user.repository";
import { realtimeService } from "../../realtime/realtime.service";
import { messagesRepository } from "./messages.repository";
import { usageService } from "../usage/usage.service";
import type { ListMessagesParams, SsMessage } from "./messages.types";

// Thin orchestration over the repository. SendSeven owns message state; we proxy.

export const messagesService = {
  list: (params: ListMessagesParams) => messagesRepository.list(params),
  getById: (id: string) => messagesRepository.getById(id),

  // A reply sent from OUR inbox is always staff-authored (the AI sends its own
  // replies via reply-worker's messagesRepository.send() call directly, tagged
  // with AI_META, never through this HTTP path) — so every successful send
  // here pauses the AI on that conversation synchronously, instead of relying
  // solely on the message.sent webhook echo (sendseven-webhook.service.ts
  // process()), which remains the backstop for replies sent directly in
  // SendSeven's own UI. Best-effort: a state-write failure must never fail
  // (or appear to fail) the send the user is waiting on.
  async send(orgId: string, body: Record<string, unknown>, senderUserId?: string | null): Promise<SsMessage> {
    // Stamp WHO sent this on the message's free-form meta so the thread can
    // show the replying agent's avatar (AI replies carry source "travana-ai"
    // from the reply worker; staff replies get "travana-agent" here). SendSeven
    // stores and echoes meta back on reads, so nothing else needs to persist it.
    if (senderUserId) {
      try {
        const sender = await userRepository.findById(senderUserId);
        if (sender) {
          const name = [sender.firstName, sender.lastName].filter(Boolean).join(" ").trim() || sender.name;
          body = {
            ...body,
            meta: {
              ...((body.meta as Record<string, unknown> | undefined) ?? {}),
              source: "travana-agent",
              agent: { id: sender.id, name, avatar: sender.image ?? null },
            },
          };
        }
      } catch (err) {
        console.warn("[messages] could not stamp sender on outbound message:", err);
      }
    }
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
  async createInternalNote(orgId: string, body: Record<string, unknown>): Promise<SsMessage> {
    const created = await messagesRepository.createInternalNote(body);
    const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : created.conversation_id;
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
