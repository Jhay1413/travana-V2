import { Request, Response } from "express";
import multer from "multer";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { AppError } from "../../utils/error-handler";
import { getScope } from "../../utils/scope";
import { messagesService } from "./messages.service";

// Attachments are forwarded straight to SendSeven, which is the system of
// record for them — memoryStorage, so nothing is written to our disk. The 50MB
// cap mirrors SendSeven's own documented limit, rejecting oversized files here
// rather than after a long upload. Extension/MIME rules are left to SendSeven
// (it does magic-byte validation and maintains the blocked-executable list); a
// second allowlist here would only drift out of sync with theirs.
export const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

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
    const { orgId, userId } = getScope(req);
    return successResponse(res, await messagesService.send(orgId, req.body ?? {}, userId), "Message sent", 201);
  }),

  // POST /api/v1/messages/internal-notes
  createInternalNote: asyncHandler(async (req: Request, res: Response) => {
    const { orgId } = getScope(req);
    return successResponse(res, await messagesService.createInternalNote(orgId, req.body ?? {}), "Note created", 201);
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

  // GET /api/v2/messages/attachments/:attachment_id/download — streams the raw
  // bytes so the browser can render inline images without the workspace token.
  // POST /api/v2/messages/attachments/upload  (multipart, field name "file")
  // Phase 1 of sending with an attachment: returns the id the client then puts
  // in the message's `attachments` array.
  uploadAttachment: asyncHandler(async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw new AppError("No file uploaded", 400);
    const uploaded = await messagesService.uploadAttachment({
      buffer: file.buffer,
      filename: file.originalname,
      contentType: file.mimetype || "application/octet-stream",
    });
    return successResponse(res, uploaded, "Attachment uploaded", 201);
  }),

  downloadAttachment: asyncHandler(async (req: Request, res: Response) => {
    const { buffer, contentType, cacheControl } = await messagesService.downloadAttachment(
      requireParam(req, "attachment_id"),
    );
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", cacheControl ?? "private, max-age=300");
    res.send(buffer);
  }),
};
