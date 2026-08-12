import axiosClient from "@/api/client/axios-client";

// SendSeven social comments (Instagram / Facebook post comments), proxied
// through our server at `/api/v2/comments`. The axios response interceptor
// unwraps the `{ success, message, data }` envelope, so methods return the
// `data` payload.

const BASE = "/api/v2/comments";

export type SsCommentState = "pending" | "auto_replied" | "replied" | "handled" | "ignored";
export type SsCommentStateFilter = SsCommentState | "unanswered";
export type SsCommentTriageState = "handled" | "ignored" | "pending";

export const PRIVATE_REPLY_MAX_LENGTH = 1000;

export interface SsCommentAuthor {
  // Instagram handle; null on Facebook, which exposes `name` instead.
  username?: string | null;
  name?: string | null;
  id?: string | null;
}

export interface SsSocialPost {
  id: string;
  external_id?: string;
  channel_id?: string;
  platform?: string | null;
  permalink?: string | null;
  media_url?: string | null;
  caption?: string | null;
  comment_count?: number;
  unanswered_count?: number;
  created_at?: string;
}

export interface SsComment {
  // SendSeven's id (`sc_…`) — what our endpoints take.
  id: string;
  // Meta's id — resolved server-side when sending a private reply.
  external_id: string;
  channel_id?: string;
  platform?: string | null;
  state?: SsCommentState | string;
  text?: string | null;
  author?: SsCommentAuthor | null;
  private_reply_window_expires_at?: string | null;
  is_reply?: boolean;
  parent_external_comment_id?: string | null;
  post_id?: string | null;
  post?: SsSocialPost | null;
  created_at?: string;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface SsPagination {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface SsCommentList {
  items: SsComment[];
  pagination: SsPagination;
}

export interface ListCommentsQuery {
  channelId?: string;
  // Comma-joined upstream; pass one or more states.
  state?: SsCommentStateFilter | SsCommentStateFilter[];
  includePost?: boolean;
  includeReply?: boolean;
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface PrivateReplyInput {
  text: string;
  channel_id?: string;
}

export interface PrivateReplyResult {
  comment_id: string;
  private_reply_id?: string;
  conversation_id?: string | null;
  // Null on a successful send when the commenter can't be resolved to a stored
  // message — the DM still lands, so this is not a failure signal.
  message_id?: string | null;
  state?: string;
  sent_at?: string;
}

export interface SsChannelCommentCapability {
  channel_id: string;
  channel_type?: string;
  name?: string | null;
  supports_comments?: boolean;
  supports_private_replies?: boolean;
}

export interface SsChannelCommentCapabilities {
  items?: SsChannelCommentCapability[];
}

function toParams(query: ListCommentsQuery): Record<string, string | number | boolean | undefined> {
  return {
    channel_id: query.channelId,
    state: Array.isArray(query.state) ? query.state.join(",") : query.state,
    include_post: query.includePost,
    include_reply: query.includeReply,
    sort_order: query.sortOrder,
    page: query.page,
    page_size: query.pageSize,
  };
}

export const commentsApi = {
  list: async (query: ListCommentsQuery = {}): Promise<SsCommentList> => {
    const { data } = await axiosClient.get<SsCommentList>(BASE, { params: toParams(query) });
    return data;
  },

  getById: async (commentId: string): Promise<SsComment> => {
    const { data } = await axiosClient.get<SsComment>(`${BASE}/${commentId}`, {
      params: { include_reply: true },
    });
    return data;
  },

  capabilities: async (): Promise<SsChannelCommentCapabilities> => {
    const { data } = await axiosClient.get<SsChannelCommentCapabilities>(`${BASE}/capabilities`);
    return data;
  },

  // Clears the comment from the unanswered queue without spending its single
  // private reply (or reopens it with "pending").
  triage: async (commentId: string, state: SsCommentTriageState): Promise<SsComment> => {
    const { data } = await axiosClient.patch<SsComment>(`${BASE}/${commentId}`, { state });
    return data;
  },

  privateReply: async (commentId: string, input: PrivateReplyInput): Promise<PrivateReplyResult> => {
    const { data } = await axiosClient.post<PrivateReplyResult>(`${BASE}/${commentId}/private-reply`, input);
    return data;
  },
};

/**
 * Whether the 7-day private-reply window is still open.
 *
 * Fails closed on a missing expiry: SendSeven sends null when it can't derive a
 * reliable comment timestamp, and a wrong `true` burns the comment's one and
 * only reply on a request that will 410.
 */
export function isPrivateReplyOpen(comment: Pick<SsComment, "private_reply_window_expires_at">, now = Date.now()): boolean {
  const expiry = comment.private_reply_window_expires_at;
  if (!expiry) return false;
  const ts = Date.parse(expiry);
  return Number.isFinite(ts) && ts > now;
}

/**
 * Whether the agent can still send a private reply. Meta permits exactly one
 * per comment, forever — so `replied` (an agent got there first) and
 * `auto_replied` (a SendSeven rule did) are both permanently closed.
 */
export function canSendPrivateReply(comment: SsComment, now = Date.now()): boolean {
  if (comment.state === "replied" || comment.state === "auto_replied") return false;
  return isPrivateReplyOpen(comment, now);
}

/** Short human reason the reply box is disabled, or null when it's usable. */
export function privateReplyBlockedReason(comment: SsComment, now = Date.now()): string | null {
  if (comment.state === "auto_replied") return "An auto-reply rule already answered this comment";
  if (comment.state === "replied") return "This comment has already had its one private reply";
  if (!isPrivateReplyOpen(comment, now)) return "The 7-day private reply window has closed";
  return null;
}
