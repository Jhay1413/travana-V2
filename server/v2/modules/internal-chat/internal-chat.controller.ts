import { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { successResponse } from "../../utils/response";
import { getScope } from "../../utils/scope";
import { internalChatService } from "./internal-chat.service";
import type { ChatMode } from "./internal-chat.types";

// Org-scoped internal chat (in-system AI chatbot for staff). All scoping is
// via getScope(req).orgId, enforced in the service/repository layers.

export const internalChatController = {
  // POST /api/v2/internal-chat/sessions
  createSession: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { mode } = req.body as { mode: ChatMode };
    const session = await internalChatService.createSession(scope, mode);
    return successResponse(res, { sessionId: session.id }, "Session created", 201);
  }),

  // POST /api/v2/internal-chat/sessions/:id/messages
  postMessage: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const { text } = req.body as { text: string };
    const result = await internalChatService.postMessage(scope, req.params.id as string, text);
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
