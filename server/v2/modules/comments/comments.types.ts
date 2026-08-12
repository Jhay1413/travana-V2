// SendSeven social comments (Instagram / Facebook Page post comments) and the
// one-shot private reply that turns a public comment into a DM.
//
// SendSeven stays the system of record: comments are readable via GET /comments
// (so the inbox can backfill history), and triage state lives there too. We
// persist nothing locally beyond the usual webhook-event idempotency row.
//
// Docs: docs.sendseven.com/guides/comments/{listen-for-comments,send-private-replies}

// Lifecycle of a comment in SendSeven's queue. `unanswered` is an alias of
// `pending` accepted by the state filter; the API reports `pending`.
export type SsCommentState = "pending" | "auto_replied" | "replied" | "handled" | "ignored";

// What the state filter accepts (superset of the reported states).
export type SsCommentStateFilter = SsCommentState | "unanswered";

// Agents may only move a comment between these three by hand. `replied` and
// `auto_replied` are set by the platform when a private reply actually goes
// out — claiming them from here would lie about whether the DM was sent.
export type SsCommentTriageState = "handled" | "ignored" | "pending";

export interface SsCommentAuthor {
  // Instagram handle. Null on Facebook, where only `name` is exposed.
  username?: string | null;
  // Display name. Facebook only.
  name?: string | null;
  id?: string | null;
  [key: string]: unknown;
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
  [key: string]: unknown;
}

export interface SsComment {
  // SendSeven's own id (`sc_…`). Distinct from `external_id`.
  id: string;
  // Meta's comment id — THIS is what the private-reply endpoint takes.
  external_id: string;
  channel_id?: string;
  platform?: string | null;
  state?: SsCommentState | string;
  text?: string | null;
  author?: SsCommentAuthor | null;
  // Absolute deadline for the one private reply Meta allows. Null means
  // SendSeven could not derive a reliable timestamp — treat as not replyable
  // rather than as "no deadline" (see isPrivateReplyOpen below).
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

export interface SsSocialPostList {
  items: SsSocialPost[];
  pagination: SsPagination;
}

export interface ListCommentsQuery {
  channel_id?: string;
  // Repeatable upstream; we pass a comma-joined list through unchanged.
  state?: string;
  include_owner?: boolean;
  include_reply?: boolean;
  include_post?: boolean;
  sort_order?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface ListPostsQuery {
  channel_id?: string;
  has_unanswered?: boolean;
  page?: number;
  page_size?: number;
}

// Body we accept from the UI. Deliberately narrower than SendSeven's schema:
// buttons/quick_replies/image_url are omitted until the UI can compose them
// (and Instagram support for buttons is still in testing upstream).
export interface PrivateReplyInput {
  text: string;
  channel_id?: string;
}

export interface PrivateReplyResult {
  comment_id: string;
  private_reply_id?: string;
  channel_id?: string;
  platform?: string;
  status?: string;
  // Null on a successful send when SendSeven cannot resolve the commenter to a
  // stored message — the DM still lands. Do not treat null as failure.
  message_id?: string | null;
  conversation_id?: string | null;
  contact_id?: string | null;
  social_comment_id?: string | null;
  state?: string;
  sent_at?: string;
  [key: string]: unknown;
}

export interface SsChannelCommentCapability {
  channel_id: string;
  channel_type?: string;
  name?: string | null;
  supports_comments?: boolean;
  supports_private_replies?: boolean;
  [key: string]: unknown;
}

export interface SsChannelCommentCapabilities {
  items?: SsChannelCommentCapability[];
  [key: string]: unknown;
}

export const PRIVATE_REPLY_MAX_LENGTH = 1000;

/**
 * Whether the 7-day private-reply window is still open.
 *
 * A null/absent expiry means SendSeven could not derive a trustworthy comment
 * timestamp, so we return false: the cost of a wrong `true` is a burnt reply
 * attempt and a confusing 410, while a wrong `false` only hides a button the
 * agent can still reach by refreshing. Fail closed.
 */
export function isPrivateReplyOpen(comment: Pick<SsComment, "private_reply_window_expires_at">, now = new Date()): boolean {
  const expiry = comment.private_reply_window_expires_at;
  if (!expiry) return false;
  const ts = Date.parse(expiry);
  return Number.isFinite(ts) && ts > now.getTime();
}

/**
 * Whether a private reply can still be sent. Meta allows exactly one private
 * reply per comment, forever — so anything already answered (by us, by an
 * agent, or by a SendSeven auto-reply rule) is permanently closed.
 */
export function canSendPrivateReply(comment: SsComment, now = new Date()): boolean {
  const state = comment.state;
  if (state === "replied" || state === "auto_replied") return false;
  return isPrivateReplyOpen(comment, now);
}
