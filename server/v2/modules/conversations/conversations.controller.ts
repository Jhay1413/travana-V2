import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/error-handler";
import { getScope } from "../../utils/scope";
import { conversationsService } from "./conversations.service";

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function bool(v: unknown): boolean | undefined {
  if (v === undefined) return undefined;
  if (v === "true" || v === true) return true;
  if (v === "false" || v === false) return false;
  return undefined;
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name] as string | undefined;
  if (!value) throw new AppError(`Missing ${name}`, 400);
  return value;
}

export const conversationsController = {
  // GET /api/v1/conversations
  list: asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string | undefined>;
    const result = await conversationsService.list({
      page: num(q.page),
      pageSize: num(q.pageSize ?? q.page_size),
      status: q.status || undefined,
      assignedTo: q.assignedTo ?? q.assigned_to,
      needsReply: bool(q.needsReply ?? q.needs_reply),
      filter: q.filter || undefined,
      contactId: q.contactId ?? q.contact_id,
      search: q.search || undefined,
      inboxId: q.inboxId ?? q.inbox_id,
    });
    return successResponse(res, result, "Conversations retrieved");
  }),

  // GET /api/v1/conversations/badge-counts
  badgeCounts: asyncHandler(async (req: Request, res: Response) => {
    const inboxId = (req.query.inboxId ?? req.query.inbox_id) as string | undefined;
    return successResponse(res, await conversationsService.badgeCounts(inboxId), "Badge counts retrieved");
  }),

  // GET /api/v1/conversations/analytics/trending-tags
  trendingTags: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.trendingTags(num(req.query.limit)), "Trending tags retrieved");
  }),

  // POST /api/v1/conversations/search-similar
  searchSimilar: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.searchSimilar(req.body), "Similar conversations retrieved");
  }),

  // POST /api/v1/conversations
  create: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.create(req.body), "Conversation created", 201);
  }),

  // POST /api/v1/conversations/bulk-close
  bulkClose: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(res, await conversationsService.bulkClose(orgId, req.body), "Conversations closed");
  }),

  // POST /api/v1/conversations/initiate
  initiate: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.initiate(req.body), "Conversation initiated");
  }),

  // POST /api/v1/conversations/check-existing
  checkExisting: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.checkExisting(req.body), "Existing conversations checked");
  }),

  // POST /api/v1/conversations/open-or-create
  openOrCreate: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.openOrCreate(req.body), "Conversation opened or created");
  }),

  // GET /api/v1/conversations/:conversation_id
  getById: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.getById(requireParam(req, "conversation_id")), "Conversation retrieved");
  }),

  // PATCH /api/v1/conversations/:conversation_id
  update: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(res, await conversationsService.update(orgId, requireParam(req, "conversation_id"), req.body ?? {}), "Conversation updated");
  }),

  // POST /api/v1/conversations/:conversation_id/assign/:user_id
  assign: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(
      res,
      await conversationsService.assign(orgId, requireParam(req, "conversation_id"), requireParam(req, "user_id")),
      "Conversation assigned",
    );
  }),

  // POST /api/v1/conversations/:conversation_id/close
  close: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(res, await conversationsService.close(orgId, requireParam(req, "conversation_id"), req.body ?? {}), "Conversation closed");
  }),

  // POST /api/v1/conversations/:conversation_id/reopen
  reopen: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(res, await conversationsService.reopen(orgId, requireParam(req, "conversation_id")), "Conversation reopened");
  }),

  // POST /api/v1/conversations/:conversation_id/snooze
  snooze: asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { snoozed_until?: string; reopen_on_message?: boolean };
    if (!body?.snoozed_until) throw new AppError("snoozed_until is required", 400);
    const { orgId } = getScope(req);
    return successResponse(
      res,
      await conversationsService.snooze(orgId, requireParam(req, "conversation_id"), { snoozed_until: body.snoozed_until, reopen_on_message: body.reopen_on_message }),
      "Conversation snoozed",
    );
  }),

  // DELETE /api/v1/conversations/:conversation_id/snooze
  unsnooze: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(res, await conversationsService.unsnooze(orgId, requireParam(req, "conversation_id")), "Snooze cleared");
  }),

  // POST /api/v1/conversations/:conversation_id/merge
  merge: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(res, await conversationsService.merge(orgId, requireParam(req, "conversation_id"), req.body), "Conversations merged");
  }),

  // POST /api/v1/conversations/:conversation_id/summarize
  summarize: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.summarize(requireParam(req, "conversation_id")), "Summary generated");
  }),

  // GET /api/v1/conversations/:conversation_id/summary
  summary: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.summary(requireParam(req, "conversation_id")), "Summary retrieved");
  }),

  // GET /api/v1/conversations/:conversation_id/previous
  previous: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(
      res,
      await conversationsService.previous(requireParam(req, "conversation_id"), num(req.query.limit)),
      "Previous conversations retrieved",
    );
  }),

  // POST /api/v1/conversations/:conversation_id/transcript
  transcriptExport: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.transcriptExport(requireParam(req, "conversation_id"), req.body), "Transcript export started", 202);
  }),

  // GET /api/v1/conversations/:conversation_id/transcript/:job_id
  transcriptStatus: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(
      res,
      await conversationsService.transcriptStatus(requireParam(req, "conversation_id"), requireParam(req, "job_id")),
      "Transcript status retrieved",
    );
  }),

  // GET /api/v1/conversations/:conversation_id/switchable-channels
  switchableChannels: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.switchableChannels(requireParam(req, "conversation_id")), "Switchable channels retrieved");
  }),

  // GET /api/v1/conversations/:conversation_id/sender-options
  senderOptions: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.senderOptions(requireParam(req, "conversation_id")), "Sender options retrieved");
  }),

  // POST /api/v1/conversations/:conversation_id/switch-channel
  switchChannel: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.switchChannel(requireParam(req, "conversation_id"), req.body), "Channel switch links generated");
  }),

  // GET /api/v1/conversations/:conversation_id/bot-session
  botSession: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.botSession(requireParam(req, "conversation_id")), "Bot session retrieved");
  }),

  // GET /api/v1/conversations/:conversation_id/available-bots
  availableBots: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.availableBots(requireParam(req, "conversation_id")), "Available bots retrieved");
  }),

  // POST /api/v1/conversations/:conversation_id/bot-session/enable
  botEnable: asyncHandler(async (req: Request, res: Response) => {
    const botId = (req.query.botId ?? req.query.bot_id) as string | undefined;
    return successResponse(res, await conversationsService.botEnable(requireParam(req, "conversation_id"), botId), "Bot enabled");
  }),

  // POST /api/v1/conversations/:conversation_id/bot-session/disable
  botDisable: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await conversationsService.botDisable(requireParam(req, "conversation_id")), "Bot disabled");
  }),

  // GET /api/v2/conversations/:conversation_id/ai-state
  aiState: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(
      res,
      await conversationsService.getAiState(orgId, requireParam(req, "conversation_id")),
      "AI state retrieved",
    );
  }),

  // POST /api/v2/conversations/:conversation_id/typing
  // Cosmetic presence ping while an agent composes. Returns 204 — there is
  // nothing to fetch, and the caller must never wait on it.
  typing: asyncHandler(async (req: Request, res: Response) => {
    const { orgId, userId } = getScope(req);
    const { stopped } = (req.body ?? {}) as { stopped?: boolean };
    await conversationsService.broadcastTyping(orgId, requireParam(req, "conversation_id"), userId, !!stopped);
    return res.status(204).end();
  }),

  // POST /api/v2/conversations/:conversation_id/ai-suggest-reply
  // On-demand "AI reply" for the composer: returns suggested text only —
  // nothing is sent, stored, or changed. Available to any staff member with
  // conversation access (it's an agent writing aid, not an admin control).
  aiSuggestReply: asyncHandler(async (req: Request, res: Response) => {
    const { orgId, userId } = getScope(req);
    const suggestion = await conversationsService.suggestReply(orgId, requireParam(req, "conversation_id"), userId);
    return successResponse(res, { suggestion }, "Suggestion generated");
  }),

  // POST /api/v2/conversations/:conversation_id/ai-state/enable
  aiEnable: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(
      res,
      await conversationsService.enableAi(orgId, requireParam(req, "conversation_id")),
      "AI enabled for this conversation",
    );
  }),

  // POST /api/v2/conversations/:conversation_id/ai-state/disable
  aiDisable: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(
      res,
      await conversationsService.disableAi(orgId, requireParam(req, "conversation_id")),
      "AI disabled for this conversation",
    );
  }),
};
