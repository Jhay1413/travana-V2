import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";
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
  async send(orgId: string, body: Record<string, unknown>): Promise<SsMessage> {
    const sent = await messagesRepository.send(body);
    if (orgId) {
      void usageService.recordSendsevenSend({ orgId, source: "manual" });
    }
    const conversationId = typeof body.conversation_id === "string" ? body.conversation_id : sent.conversation_id;
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

  createInternalNote: (body: Record<string, unknown>) => messagesRepository.createInternalNote(body),
  mentionUsers: () => messagesRepository.mentionUsers(),
  react: (id: string, body: unknown) => messagesRepository.react(id, body),
  removeReaction: (id: string, body: unknown) => messagesRepository.removeReaction(id, body),
  translate: (id: string, body: unknown) => messagesRepository.translate(id, body),
  downloadAttachment: (attachmentId: string) => messagesRepository.downloadAttachment(attachmentId),
};
