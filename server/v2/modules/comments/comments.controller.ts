import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/error-handler";
import { getScope } from "../../utils/scope";
import { commentsService } from "./comments.service";
import { canSendPrivateReply, type ListCommentsQuery, type SsCommentTriageState } from "./comments.types";

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return v === "true" || v === true;
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name] as string | undefined;
  if (!value) throw new AppError(`Missing ${name}`, 400);
  return value;
}

function listQuery(req: Request): ListCommentsQuery {
  const q = req.query as Record<string, unknown>;
  const sortOrder = q.sort_order ?? q.sortOrder;
  return {
    channel_id: (q.channel_id ?? q.channelId) as string | undefined,
    // Upstream takes a repeatable `state`; express gives us either a string or
    // an array depending on how the client serialised it. Normalise to the
    // comma-joined form the proxy passes straight through.
    state: Array.isArray(q.state) ? q.state.join(",") : (q.state as string | undefined),
    include_owner: bool(q.include_owner ?? q.includeOwner),
    include_reply: bool(q.include_reply ?? q.includeReply),
    include_post: bool(q.include_post ?? q.includePost),
    sort_order: sortOrder === "asc" ? "asc" : sortOrder === "desc" ? "desc" : undefined,
    page: num(q.page),
    page_size: num(q.page_size ?? q.pageSize),
  };
}

export const commentsController = {
  // GET /api/v2/comments
  list: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await commentsService.list(listQuery(req)), "Comments retrieved");
  }),

  // GET /api/v2/comments/posts
  listPosts: asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, unknown>;
    const result = await commentsService.listPosts({
      channel_id: (q.channel_id ?? q.channelId) as string | undefined,
      has_unanswered: bool(q.has_unanswered ?? q.hasUnanswered),
      page: num(q.page),
      page_size: num(q.page_size ?? q.pageSize),
    });
    return successResponse(res, result, "Posts retrieved");
  }),

  // GET /api/v2/comments/posts/:postId/comments
  listPostComments: asyncHandler(async (req: Request, res: Response) => {
    const result = await commentsService.listPostComments(requireParam(req, "postId"), listQuery(req));
    return successResponse(res, result, "Comments retrieved");
  }),

  // GET /api/v2/comments/capabilities
  capabilities: asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(res, await commentsService.capabilities(), "Comment capabilities retrieved");
  }),

  // GET /api/v2/comments/:commentId
  getById: asyncHandler(async (req: Request, res: Response) => {
    const includeReply = bool((req.query as Record<string, unknown>).include_reply) ?? true;
    const comment = await commentsService.getById(requireParam(req, "commentId"), includeReply);
    return successResponse(res, comment, "Comment retrieved");
  }),

  // PATCH /api/v2/comments/:commentId — triage only (handled/ignored/pending);
  // shape enforced by triageCommentValidator.
  triage: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    const { state } = req.body as { state: SsCommentTriageState };
    const updated = await commentsService.triage(orgId, requireParam(req, "commentId"), state);
    return successResponse(res, updated, "Comment updated");
  }),

  // POST /api/v2/comments/:commentId/private-reply
  //
  // `commentId` is SendSeven's `sc_…` id, not Meta's. We re-read the comment
  // server-side to resolve Meta's `external_id` and to re-check eligibility
  // against fresh state — the list the agent clicked from may be minutes old,
  // and a wasted attempt here is unrecoverable (one reply per comment, ever).
  privateReply: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    // Length/emptiness enforced by privateReplyValidator.
    const body = req.body as { text: string; channel_id?: string };
    const text = body.text.trim();

    const comment = await commentsService.getById(requireParam(req, "commentId"), true);
    if (!comment?.external_id) {
      throw new AppError("This comment has no Meta id, so it can't receive a private reply", 422);
    }
    if (!canSendPrivateReply(comment)) {
      const state = comment.state;
      if (state === "replied" || state === "auto_replied") {
        throw new AppError(
          "This comment has already received its private reply. Meta allows only one per comment.",
          409,
        );
      }
      throw new AppError("The 7-day private reply window for this comment has expired.", 410);
    }

    const result = await commentsService.privateReply(orgId, comment, { text, channel_id: body.channel_id });
    return successResponse(res, result, "Private reply sent", 201);
  }),
};
