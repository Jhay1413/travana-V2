import { conversationsRepository } from "./conversations.repository";
import type { ListConversationsParams } from "./conversations.types";

// Service layer. SendSeven is the source of truth for conversation state, so
// this is thin orchestration over the repository. Client-side code owns the
// snake_case → UI mapping; the proxy forwards provider payloads verbatim.

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
  update: (id: string, body: Record<string, unknown>) => conversationsRepository.update(id, body),
  assign: (id: string, userId: string) => conversationsRepository.assign(id, userId),
  close: (id: string, body: unknown) => conversationsRepository.close(id, body),
  reopen: (id: string) => conversationsRepository.reopen(id),
  snooze: (id: string, body: { snoozed_until: string; reopen_on_message?: boolean }) =>
    conversationsRepository.snooze(id, body),
  unsnooze: (id: string) => conversationsRepository.unsnooze(id),
  merge: (id: string, body: unknown) => conversationsRepository.merge(id, body),
  summarize: (id: string) => conversationsRepository.summarize(id),
  transcriptExport: (id: string, body: unknown) => conversationsRepository.transcriptExport(id, body),
  switchChannel: (id: string, body: unknown) => conversationsRepository.switchChannel(id, body),
  botDisable: (id: string) => conversationsRepository.botDisable(id),
  botEnable: (id: string, botId?: string) => conversationsRepository.botEnable(id, botId),

  bulkClose: (body: unknown) => conversationsRepository.bulkClose(body),
  searchSimilar: (body: unknown) => conversationsRepository.searchSimilar(body),
  initiate: (body: unknown) => conversationsRepository.initiate(body),
  checkExisting: (body: unknown) => conversationsRepository.checkExisting(body),
  openOrCreate: (body: unknown) => conversationsRepository.openOrCreate(body),
};
