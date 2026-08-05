import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";
import { realtimeService } from "../../realtime/realtime.service";
import { conversationsRepository } from "./conversations.repository";
import type { ListConversationsParams } from "./conversations.types";

// Fans a state change out to every agent in the org over SSE so their inbox
// lists move in realtime (snooze/close/assign/etc. done by one agent update the
// others' screens). Best-effort: a publish failure must never fail the write
// the user is waiting on. SendSeven's conversation.updated webhook echo also
// covers some of these, but not reliably for API-driven changes — this is the
// synchronous path, the webhook stays the backstop.
function publishUpdated(orgId: string, conversationId: string): void {
  if (!orgId || !conversationId) return;
  try {
    realtimeService.publish(orgId, { type: "conversation.updated", conversationId });
  } catch (err) {
    console.warn(`[conversations] realtime publish failed for conv ${conversationId}:`, err);
  }
}

// Service layer. SendSeven is the source of truth for conversation state, so
// this is thin orchestration over the repository. Client-side code owns the
// snake_case → UI mapping; the proxy forwards provider payloads verbatim.
//
// The AI enable/disable/status trio is the one exception — that's OUR data
// (sendseven_conversation_state), not SendSeven's, so it delegates to the
// sendseven-webhook module's service (service→service, matching bot-config's
// cross-module calls into the same service) rather than the repository above.

export const conversationsService = {
  list: (params: ListConversationsParams) => conversationsRepository.list(params),
  getById: (id: string) => conversationsRepository.getById(id),
  badgeCounts: (inboxId?: string) => conversationsRepository.badgeCounts(inboxId),
  trendingTags: (limit?: number) => conversationsRepository.trendingTags(limit),
  summary: (id: string) => conversationsRepository.summary(id),
  previous: (id: string, limit?: number) => conversationsRepository.previous(id, limit),
  switchableChannels: (id: string) => conversationsRepository.switchableChannels(id),
  senderOptions: (id: string) => conversationsRepository.senderOptions(id),
  botSession: (id: string) => conversationsRepository.botSession(id),
  availableBots: (id: string) => conversationsRepository.availableBots(id),
  transcriptStatus: (id: string, jobId: string) => conversationsRepository.transcriptStatus(id, jobId),

  create: (body: unknown) => conversationsRepository.create(body),
  async update(orgId: string, id: string, body: Record<string, unknown>) {
    const result = await conversationsRepository.update(id, body);
    publishUpdated(orgId, id);
    return result;
  },
  async assign(orgId: string, id: string, userId: string) {
    const result = await conversationsRepository.assign(id, userId);
    publishUpdated(orgId, id);
    return result;
  },
  async close(orgId: string, id: string, body: unknown) {
    const result = await conversationsRepository.close(id, body);
    publishUpdated(orgId, id);
    return result;
  },
  async reopen(orgId: string, id: string) {
    const result = await conversationsRepository.reopen(id);
    publishUpdated(orgId, id);
    return result;
  },
  async snooze(orgId: string, id: string, body: { snoozed_until: string; reopen_on_message?: boolean }) {
    const result = await conversationsRepository.snooze(id, body);
    publishUpdated(orgId, id);
    return result;
  },
  async unsnooze(orgId: string, id: string) {
    const result = await conversationsRepository.unsnooze(id);
    publishUpdated(orgId, id);
    return result;
  },
  async merge(orgId: string, id: string, body: unknown) {
    const result = await conversationsRepository.merge(id, body);
    publishUpdated(orgId, id);
    return result;
  },
  summarize: (id: string) => conversationsRepository.summarize(id),
  transcriptExport: (id: string, body: unknown) => conversationsRepository.transcriptExport(id, body),
  switchChannel: (id: string, body: unknown) => conversationsRepository.switchChannel(id, body),
  botDisable: (id: string) => conversationsRepository.botDisable(id),
  botEnable: (id: string, botId?: string) => conversationsRepository.botEnable(id, botId),

  getAiState: (orgId: string, id: string) => sendsevenWebhookService.getAiState(orgId, id),
  enableAi: (orgId: string, id: string) => sendsevenWebhookService.enableAi(orgId, id),
  disableAi: (orgId: string, id: string) => sendsevenWebhookService.disableAi(orgId, id),

  async bulkClose(orgId: string, body: unknown) {
    const result = await conversationsRepository.bulkClose(body);
    const ids = (body as { conversation_ids?: unknown })?.conversation_ids;
    if (Array.isArray(ids)) {
      for (const id of ids) if (typeof id === "string") publishUpdated(orgId, id);
    }
    return result;
  },
  searchSimilar: (body: unknown) => conversationsRepository.searchSimilar(body),
  initiate: (body: unknown) => conversationsRepository.initiate(body),
  checkExisting: (body: unknown) => conversationsRepository.checkExisting(body),
  openOrCreate: (body: unknown) => conversationsRepository.openOrCreate(body),
};
