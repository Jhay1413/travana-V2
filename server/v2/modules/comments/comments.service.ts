import { realtimeService } from "../../realtime/realtime.service";
import { usageService } from "../usage/usage.service";
import { commentsRepository } from "./comments.repository";
import type {
  ListCommentsQuery,
  ListPostsQuery,
  PrivateReplyInput,
  PrivateReplyResult,
  SsComment,
  SsCommentTriageState,
} from "./comments.types";

// Thin orchestration over the repository. SendSeven owns comment state; we
// proxy, then nudge every open inbox tab so a reply or a triage lands live.

function publish(orgId: string, commentId: string): void {
  if (!orgId) return;
  try {
    realtimeService.publish(orgId, { type: "comment.updated", commentId });
  } catch (err) {
    console.warn(`[comments] realtime publish failed for comment ${commentId}:`, err);
  }
}

export const commentsService = {
  list: (query: ListCommentsQuery) => commentsRepository.list(query),
  getById: (id: string, includeReply?: boolean) => commentsRepository.getById(id, includeReply),
  listPosts: (query: ListPostsQuery) => commentsRepository.listPosts(query),
  listPostComments: (postId: string, query: ListCommentsQuery) => commentsRepository.listPostComments(postId, query),
  capabilities: () => commentsRepository.capabilities(),

  async triage(orgId: string, id: string, state: SsCommentTriageState): Promise<SsComment> {
    const updated = await commentsRepository.triage(id, state);
    publish(orgId, id);
    return updated;
  },

  /**
   * Sends the single private reply Meta permits for a comment.
   *
   * Deliberately NOT idempotent-retryable: a second attempt returns 409 from
   * upstream, which the repository turns into an explicit "already replied"
   * message rather than a silent success. That is the honest outcome — the
   * reply is spent either way.
   *
   * Note the knock-on effect: the DM this creates comes back as an outbound
   * `message.sent` webhook that the handler in sendseven-webhook.service.ts
   * reads as a human reply and hands the conversation to a human. That is
   * correct today, because only agents can reach this path. When AI-authored
   * private replies land, they must tag the message so that handler can tell
   * them apart — the private-reply endpoint takes no `meta` field, and its
   * `message_id` may be null on success, so the `aisent:` ledger cannot be
   * relied on here. See docs/sendseven-comments-plan.md.
   */
  async privateReply(orgId: string, comment: SsComment, input: PrivateReplyInput): Promise<PrivateReplyResult> {
    const result = await commentsRepository.privateReply(comment.external_id, {
      text: input.text,
      // Always pass the channel through when we know it: upstream requires it
      // whenever the comment isn't stored in the workspace (400
      // `channel_required`), and it is harmless when it is.
      channel_id: input.channel_id ?? (typeof comment.channel_id === "string" ? comment.channel_id : undefined),
    });
    if (orgId) {
      // Private replies bill exactly like outbound messages on that channel.
      void usageService.recordSendsevenSend({ orgId, source: "manual" });
    }
    publish(orgId, comment.id);
    return result;
  },
};
