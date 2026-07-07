import { AppError } from "../../utils/error-handler";
import { sendSevenRequest, useSampleData, warnSendSevenOnce, type SsQuery } from "../../utils/sendseven";
import {
  sampleBadgeCounts,
  sampleConversationById,
  sampleConversationList,
  sampleConversationPatched,
} from "./conversations.fixtures";
import type {
  ListConversationsParams,
  SsBadgeCounts,
  SsConversation,
  SsConversationList,
} from "./conversations.types";

// Repository layer: the ONLY place that talks to the SendSeven conversations
// API (via the shared client). Thin gateway — responses are forwarded as-is;
// typing/mapping happens client-side.
//
// TEMPORARY: while the API is unconfigured, read + status-change ops serve
// sample fixture data instead of erroring, so the inbox is usable end-to-end.

const warnOnce = warnSendSevenOnce;

// `path` is relative to `/conversations` (e.g. "", "/${id}", "/badge-counts").
function request<T>(method: string, path: string, opts: { query?: SsQuery; body?: unknown } = {}): Promise<T> {
  return sendSevenRequest<T>(method, `/conversations${path}`, opts);
}

function listQuery(p: ListConversationsParams): SsQuery {
  return {
    page: p.page,
    page_size: p.pageSize,
    status: p.status,
    assigned_to: p.assignedTo,
    needs_reply: p.needsReply,
    filter: p.filter,
    contact_id: p.contactId,
    search: p.search,
    inbox_id: p.inboxId,
  };
}

function notFound(id: string): never {
  throw new AppError(`Conversation ${id} not found`, 404);
}

export const conversationsRepository = {
  // ── Reads ──
  list(params: ListConversationsParams): Promise<SsConversationList> {
    if (useSampleData()) {
      warnOnce();
      return Promise.resolve(sampleConversationList(params));
    }
    return request("GET", "", { query: listQuery(params) });
  },

  getById(id: string): Promise<SsConversation> {
    if (useSampleData()) {
      warnOnce();
      return Promise.resolve(sampleConversationById(id) ?? notFound(id));
    }
    return request("GET", `/${id}`, {});
  },

  badgeCounts(inboxId?: string): Promise<SsBadgeCounts> {
    if (useSampleData()) {
      warnOnce();
      return Promise.resolve(sampleBadgeCounts());
    }
    return request("GET", "/badge-counts", { query: { inbox_id: inboxId } });
  },

  trendingTags(limit?: number): Promise<unknown> {
    return request("GET", "/analytics/trending-tags", { query: { limit } });
  },

  summary(id: string): Promise<unknown> {
    return request("GET", `/${id}/summary`, {});
  },

  previous(id: string, limit?: number): Promise<unknown> {
    return request("GET", `/${id}/previous`, { query: { limit } });
  },

  switchableChannels(id: string): Promise<unknown> {
    return request("GET", `/${id}/switchable-channels`, {});
  },

  senderOptions(id: string): Promise<unknown> {
    return request("GET", `/${id}/sender-options`, {});
  },

  botSession(id: string): Promise<unknown> {
    return request("GET", `/${id}/bot-session`, {});
  },

  availableBots(id: string): Promise<unknown> {
    return request("GET", `/${id}/available-bots`, {});
  },

  transcriptStatus(id: string, jobId: string): Promise<unknown> {
    return request("GET", `/${id}/transcript/${jobId}`, {});
  },

  // ── Writes: single conversation (fixture-backed status changes) ──
  create(body: unknown): Promise<SsConversation> {
    return request("POST", "", { body });
  },

  update(id: string, body: Record<string, unknown>): Promise<SsConversation> {
    if (useSampleData()) return Promise.resolve(sampleConversationPatched(id, body) ?? notFound(id));
    return request("PATCH", `/${id}`, { body });
  },

  assign(id: string, userId: string): Promise<SsConversation> {
    if (useSampleData()) {
      return Promise.resolve(sampleConversationPatched(id, { assigned_user_id: userId, status: "assigned" }) ?? notFound(id));
    }
    return request("POST", `/${id}/assign/${userId}`, {});
  },

  close(id: string, body: unknown): Promise<SsConversation> {
    if (useSampleData()) {
      return Promise.resolve(sampleConversationPatched(id, { status: "closed", closed_at: new Date().toISOString() }) ?? notFound(id));
    }
    return request("POST", `/${id}/close`, { body });
  },

  reopen(id: string): Promise<SsConversation> {
    if (useSampleData()) return Promise.resolve(sampleConversationPatched(id, { status: "open", closed_at: null }) ?? notFound(id));
    return request("POST", `/${id}/reopen`, {});
  },

  snooze(id: string, body: { snoozed_until: string; reopen_on_message?: boolean }): Promise<SsConversation> {
    if (useSampleData()) {
      return Promise.resolve(sampleConversationPatched(id, { status: "snoozed", snoozed_until: body.snoozed_until }) ?? notFound(id));
    }
    return request("POST", `/${id}/snooze`, { body });
  },

  unsnooze(id: string): Promise<SsConversation> {
    if (useSampleData()) return Promise.resolve(sampleConversationPatched(id, { status: "open", snoozed_until: null }) ?? notFound(id));
    return request("DELETE", `/${id}/snooze`, {});
  },

  merge(id: string, body: unknown): Promise<SsConversation> {
    return request("POST", `/${id}/merge`, { body });
  },

  summarize(id: string): Promise<unknown> {
    return request("POST", `/${id}/summarize`, {});
  },

  transcriptExport(id: string, body: unknown): Promise<unknown> {
    return request("POST", `/${id}/transcript`, { body });
  },

  switchChannel(id: string, body: unknown): Promise<unknown> {
    return request("POST", `/${id}/switch-channel`, { body });
  },

  botDisable(id: string): Promise<unknown> {
    return request("POST", `/${id}/bot-session/disable`, {});
  },

  botEnable(id: string, botId?: string): Promise<unknown> {
    return request("POST", `/${id}/bot-session/enable`, { query: { bot_id: botId } });
  },

  // ── Writes: collection-level ──
  bulkClose(body: unknown): Promise<unknown> {
    return request("POST", "/bulk-close", { body });
  },

  searchSimilar(body: unknown): Promise<unknown> {
    return request("POST", "/search-similar", { body });
  },

  initiate(body: unknown): Promise<unknown> {
    return request("POST", "/initiate", { body });
  },

  checkExisting(body: unknown): Promise<unknown> {
    return request("POST", "/check-existing", { body });
  },

  openOrCreate(body: unknown): Promise<unknown> {
    return request("POST", "/open-or-create", { body });
  },
};
