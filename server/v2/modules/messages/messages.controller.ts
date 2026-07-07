import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/error-handler";
import { messagesService } from "./messages.service";

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function requireParam(req: Request, name: string): string {
  const value = req.params[name] as string | undefined;
  if (!value) throw new AppError(`Missing ${name}`, 400);
  return value;
}

export const messagesController = {
  // GET /api/v1/messages
  list: asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as Record<string, string | undefined>;
    const result = await messagesService.list({
      conversationId: q.conversationId ?? q.conversation_id,
      page: num(q.page),
      pageSize: num(q.pageSize ?? q.page_size),
      cursor: q.cursor || undefined,
    });
    return successResponse(res, result, "Messages retrieved");
  }),

  // POST /api/v1/messages
  send: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await messagesService.send(req.body ?? {}), "Message sent", 201);
  }),

  // POST /api/v1/messages/internal-notes
  createInternalNote: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await messagesService.createInternalNote(req.body ?? {}), "Note created", 201);
  }),

  // GET /api/v1/messages/mention-users
  mentionUsers: asyncHandler(async (_req: Request, res: Response) => {
    return successResponse(res, await messagesService.mentionUsers(), "Mentionable users retrieved");
  }),

  // GET /api/v1/messages/:message_id
  getById: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await messagesService.getById(requireParam(req, "message_id")), "Message retrieved");
  }),

  // POST /api/v1/messages/:message_id/react
  react: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await messagesService.react(requireParam(req, "message_id"), req.body), "Reaction added");
  }),

  // DELETE /api/v1/messages/:message_id/react
  removeReaction: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await messagesService.removeReaction(requireParam(req, "message_id"), req.body), "Reaction removed");
  }),

  // POST /api/v1/messages/:message_id/translate
  translate: asyncHandler(async (req: Request, res: Response) => {
    return successResponse(res, await messagesService.translate(requireParam(req, "message_id"), req.body), "Message translated");
  }),
};
