import { Request, Response } from "express";
import multer from "multer";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";
import { internalChatService } from "./internal-chat.service";
import type { ChatMode } from "./internal-chat.types";
import type { PendingAttachment } from "../sendseven-webhook/admin-data.service";

// Org-scoped internal chat (in-system AI chatbot for staff). All scoping is
// via getScope(req).orgId, enforced in the service/repository layers.

// Optional image attachment(s) on a TEST-FLOW message (multipart field
// "attachments") — lets a tester exercise the document-submission path
// (vision read → admin route → ticket) from the chat widget. memoryStorage,
// same pattern as messages.controller's attachmentUpload: the bytes only
// live for this one turn (handed to the testflow driver, attached to
// whatever ticket the admin bot opens), nothing is written to our disk.
// Caps mirror the vision guardrails (IMAGE_TRIAGE_MAX_IMAGES/_BYTES).
export const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});

// Multer's parsed files → the driver's transport-agnostic attachment shape.
function toPendingAttachments(files: Request["files"]): PendingAttachment[] {
  if (!Array.isArray(files)) return [];
  return files.map((f) => ({
    buffer: f.buffer,
    filename: f.originalname,
    contentType: f.mimetype,
    size: f.size,
  }));
}

export const internalChatController = {
  // POST /api/v2/internal-chat/sessions
  createSession: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { mode } = req.body as { mode: ChatMode };
    const session = await internalChatService.createSession(scope, mode);
    return successResponse(res, { sessionId: session.id }, "Session created", 201);
  }),

  // POST /api/v2/internal-chat/sessions/:id/messages
  // Accepts plain JSON ({text}) or multipart ("text" field + up to 3 image
  // files under "attachments") — multer only engages on multipart requests,
  // so the JSON path is untouched.
  postMessage: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { text } = req.body as { text: string };
    const attachments = toPendingAttachments(req.files);
    const result = await internalChatService.postMessage(scope, req.params.id as string, text, attachments);
    if (result.kind === "test_flow_pending") {
      return res.status(501).json({ success: false, reply: result.reply });
    }
    return successResponse(res, result.message, "Reply generated");
  }),

  // GET /api/v2/internal-chat/sessions/:id/messages
  listMessages: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const messages = await internalChatService.listMessages(scope, req.params.id as string);
    return successResponse(res, messages, "Transcript");
  }),
};
