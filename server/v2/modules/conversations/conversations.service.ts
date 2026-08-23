import { sendsevenWebhookService } from "../sendseven-webhook/sendseven-webhook.service";
import { suggestAiReply } from "../sendseven-webhook/suggest-reply.service";
import { userRepository } from "../user/user.repository";
import { AppError } from "../../utils/error-handler";
import { realtimeService } from "../../realtime/realtime.service";
import { conversationsRepository } from "./conversations.repository";
import { conversationsAssignmentRepository, type ConversationType, type LocalConversationState } from "./conversations-assignment.repository";
import { AppError } from "../../utils/error-handler";
import type { ListConversationsParams, SsBadgeCounts, SsConversation, SsConversationList } from "./conversations.types";

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

// ── Local assignment overlay ──────────────────────────────────────────────────
// Conversation assignment is PLATFORM data (Travana agents are not SendSeven
// users), stored in sendseven_conversation_state and stamped onto every proxied
// conversation payload here, in the same shape SendSeven would use
// (assigned_user_id + assigned_user{id,name}) so the client mapping is unchanged.

function stampAssignment(conversation: SsConversation, state: LocalConversationState | null | undefined): SsConversation {
  const assignee = state?.assignee ?? null;
  conversation.assigned_user_id = assignee?.id ?? null;
  conversation.assigned_user = assignee ? { id: assignee.id, name: assignee.name } : null;
  conversation.conversation_type = state?.conversationType ?? null;
  return conversation;
}

async function overlayOne(orgId: string, conversation: SsConversation): Promise<SsConversation> {
  const state = await conversationsAssignmentRepository.get(orgId, conversation.id);
  return stampAssignment(conversation, state);
}

function parseConversationType(v: unknown): ConversationType | null {
  if (v === null || v === undefined || v === "") return null;
  if (v === "sales" || v === "admin") return v;
  throw new AppError('conversation_type must be "sales", "admin" or null', 400);
}

async function overlayList(orgId: string, list: SsConversationList): Promise<SsConversationList> {
  const ids = (list.items ?? []).map((c) => c.id);
  const assignments = await conversationsAssignmentRepository.getMany(orgId, ids);
  for (const item of list.items ?? []) stampAssignment(item, assignments.get(item.id));
  return list;
}

// Resolve an assignedTo filter value ('me' | 'unassigned' | 'me_and_unassigned'
// | <travana user id>) against the overlaid assignment. Filtering happens after
// the SendSeven page fetch (assignment is local), so a filtered page can hold
// fewer rows than page_size — acceptable at inbox page sizes.
function matchesAssignedTo(item: SsConversation, filter: string, currentUserId: string | null): boolean {
  const assigned = item.assigned_user_id ?? null;
  if (filter === "unassigned") return assigned === null;
  if (filter === "me") return !!currentUserId && assigned === currentUserId;
  if (filter === "me_and_unassigned") return assigned === null || (!!currentUserId && assigned === currentUserId);
  return assigned === filter;
}

// Service layer. SendSeven is the source of truth for conversation state, so
// this is thin orchestration over the repository. Client-side code owns the
// snake_case → UI mapping; the proxy forwards provider payloads verbatim.
//
// Two exceptions are OUR data, not SendSeven's:
// - assignment (sendseven_conversation_state.assigned_user_id) — see overlay above
// - the AI enable/disable/status trio — delegates to the sendseven-webhook module

export const conversationsService = {
  async list(orgId: string, params: ListConversationsParams, currentUserId: string | null) {
    // assignedTo is resolved locally — never forwarded to SendSeven.
    const { assignedTo, ...rest } = params;
    const list = await conversationsRepository.list(rest);
    await overlayList(orgId, list);
    if (assignedTo) {
      list.items = (list.items ?? []).filter((c) => matchesAssignedTo(c, assignedTo, currentUserId));
    }
    return list;
  },

  async getById(orgId: string, id: string) {
    const conversation = await conversationsRepository.getById(id);
    return overlayOne(orgId, conversation);
  },

  // SendSeven's counts, with unanswered_assigned_to_me recomputed from LOCAL
  // assignment (SendSeven resolves "me" against its own users, which we don't
  // use). One extra needs-reply page fetch; badge polling is light.
  async badgeCounts(orgId: string, currentUserId: string | null, inboxId?: string): Promise<SsBadgeCounts> {
    const counts = await conversationsRepository.badgeCounts(inboxId);
    if (!orgId || !currentUserId) return counts;
    try {
      const needsReply = await conversationsRepository.list({ needsReply: true, pageSize: 100, inboxId });
      const mine = await conversationsAssignmentRepository.conversationIdsAssignedTo(orgId, currentUserId);
      const mineSet = new Set(mine);
      counts.unanswered_assigned_to_me = (needsReply.items ?? []).filter((c) => mineSet.has(c.id)).length;
    } catch (err) {
      console.warn("[conversations] local unanswered_assigned_to_me recount failed:", err);
    }
    return counts;
  },

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
    // assigned_user_id and conversation_type are OURS — intercept them, write
    // locally, and forward the rest (if any) to SendSeven.
    const { assigned_user_id, conversation_type, ...rest } = body;
    if ("assigned_user_id" in body) {
      await conversationsAssignmentRepository.set(orgId, id, (assigned_user_id as string | null) ?? null);
    }
    if ("conversation_type" in body) {
      await conversationsAssignmentRepository.setType(orgId, id, parseConversationType(conversation_type));
    }
    const result =
      Object.keys(rest).length > 0
        ? await conversationsRepository.update(id, rest)
        : await conversationsRepository.getById(id);
    publishUpdated(orgId, id);
    return overlayOne(orgId, result);
  },

  // Assignment is local: `userId` is a TRAVANA user id, validated against our
  // user table. Nothing is written to SendSeven.
  async assign(orgId: string, id: string, userId: string) {
    const assignee = await userRepository.findById(userId);
    if (!assignee) throw new AppError(`User ${userId} not found`, 404);
    await conversationsAssignmentRepository.set(orgId, id, userId);
    const conversation = await conversationsRepository.getById(id);
    publishUpdated(orgId, id);
    return overlayOne(orgId, conversation);
  },

  // Auto-claim on reply: when a Travana agent replies to an UNASSIGNED
  // conversation, it becomes theirs. Already-assigned conversations are left
  // alone — replying in a teammate's thread must not silently steal it.
  // Best-effort by contract: callers fire-and-forget, failures only warn.
  async autoAssignReplier(orgId: string, conversationId: string, travanaUserId: string): Promise<void> {
    try {
      const current = await conversationsAssignmentRepository.get(orgId, conversationId);
      if (current?.assignee) return;
      await conversationsAssignmentRepository.set(orgId, conversationId, travanaUserId);
      publishUpdated(orgId, conversationId);
    } catch (err) {
      console.warn(`[conversations] auto-assign after reply failed for conv ${conversationId}:`, err);
    }
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
  // On-demand composer suggestion — side-effect-free, see suggest-reply.service.
  suggestReply: (orgId: string, id: string, userId?: string | null) => suggestAiReply(orgId, id, userId),

  // "<agent> is typing…" — broadcast to the org so a colleague in the same
  // conversation sees it. Nothing is stored: the event is cosmetic and the
  // client expires its own indicator, so this is deliberately fire-and-forget
  // and never fails the caller's request.
  async broadcastTyping(orgId: string, conversationId: string, userId: string | null, stopped: boolean): Promise<void> {
    if (!orgId || !conversationId) return;
    let name: string | undefined;
    if (userId) {
      // Resolved server-side rather than trusted from the client: the name is
      // shown to colleagues, so it should be the real one on the account.
      const found = await userRepository.findRoleAndNameById(userId).catch(() => undefined);
      name = found?.name ?? undefined;
    }
    try {
      realtimeService.publish(orgId, {
        type: "typing",
        conversationId,
        typing: { actor: "agent", name, userId: userId ?? undefined, stopped },
      });
    } catch (err) {
      console.warn(`[conversations] typing publish failed for conv ${conversationId}:`, err);
    }
  },

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
