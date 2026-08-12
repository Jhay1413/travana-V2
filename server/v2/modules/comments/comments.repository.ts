import { AppError } from "../../utils/error-handler";
import { sendSevenRequest, useSampleData } from "../../utils/sendseven";
import type {
  ListCommentsQuery,
  ListPostsQuery,
  PrivateReplyInput,
  PrivateReplyResult,
  SsChannelCommentCapabilities,
  SsComment,
  SsCommentList,
  SsCommentTriageState,
  SsSocialPostList,
} from "./comments.types";

// Repository: proxies comment reads/triage/private-replies to SendSeven with
// the caller's own org token (resolved by the sendSevenContext middleware).
//
// Comments are a Beta feature gated per workspace, so an org with the flag off
// gets a 403 `feature_not_enabled` from upstream — surfaced verbatim rather
// than swallowed, so the UI can tell "not enabled" from "nothing here yet".

const EMPTY_PAGINATION = { total: 0, page: 1, page_size: 25, total_pages: 0, has_next: false, has_prev: false };

/**
 * Maps the private-reply endpoint's documented failures onto messages an agent
 * can act on. `sendSevenRequest` preserves the upstream 4xx status but flattens
 * the `{ detail: { error_code, … } }` body to a generic string, so we key off
 * status — which is unambiguous here because this call sends no
 * buttons/quick_replies (the only other source of a 422).
 */
function explainPrivateReplyFailure(err: unknown): never {
  if (!(err instanceof AppError)) throw err;
  switch (err.statusCode) {
    case 409:
      throw new AppError(
        "This comment has already received its private reply. Meta allows only one per comment.",
        409,
      );
    case 410:
      throw new AppError(
        "The 7-day private reply window for this comment has expired.",
        410,
      );
    case 422:
      throw new AppError(
        "This comment can't receive a private reply (it may be on an ad, deleted, or written by the Page itself).",
        422,
      );
    case 403:
      throw new AppError(
        "Comments and private replies aren't enabled for this workspace yet. Ask SendSeven to switch on the Comments feature.",
        403,
      );
    case 404:
      throw new AppError("The channel for this comment is missing, inactive, or the wrong type.", 404);
    default:
      throw err;
  }
}

export const commentsRepository = {
  list(query: ListCommentsQuery): Promise<SsCommentList> {
    if (useSampleData()) return Promise.resolve({ items: [], pagination: EMPTY_PAGINATION });
    return sendSevenRequest("GET", "/comments", { query: { ...query } });
  },

  getById(id: string, includeReply?: boolean): Promise<SsComment> {
    return sendSevenRequest("GET", `/comments/${id}`, { query: { include_reply: includeReply } });
  },

  // Clears a comment from the unanswered queue WITHOUT spending its one
  // private reply — or reopens it with `pending`.
  triage(id: string, state: SsCommentTriageState): Promise<SsComment> {
    return sendSevenRequest("PATCH", `/comments/${id}`, { body: { state } });
  },

  listPosts(query: ListPostsQuery): Promise<SsSocialPostList> {
    if (useSampleData()) return Promise.resolve({ items: [], pagination: EMPTY_PAGINATION });
    return sendSevenRequest("GET", "/comments/posts", { query: { ...query } });
  },

  listPostComments(postId: string, query: ListCommentsQuery): Promise<SsCommentList> {
    return sendSevenRequest("GET", `/comments/posts/${postId}/comments`, { query: { ...query } });
  },

  capabilities(): Promise<SsChannelCommentCapabilities> {
    if (useSampleData()) return Promise.resolve({ items: [] });
    return sendSevenRequest("GET", "/channels/comment-capabilities", {});
  },

  // `externalCommentId` is META's comment id (SsComment.external_id), not
  // SendSeven's `sc_…` id. Passing the wrong one 404s.
  async privateReply(externalCommentId: string, body: PrivateReplyInput): Promise<PrivateReplyResult> {
    if (useSampleData()) {
      throw new AppError(
        "SendSeven isn't connected for this organisation yet. Ask your platform admin to add the workspace token first.",
        400,
      );
    }
    try {
      return await sendSevenRequest<PrivateReplyResult>(
        "POST",
        `/comments/${encodeURIComponent(externalCommentId)}/private-reply`,
        { body },
      );
    } catch (err) {
      return explainPrivateReplyFailure(err);
    }
  },
};
