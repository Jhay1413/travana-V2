import { Request, Response } from "express";
import { facebookService } from "../services/facebook.service";
import { successResponse } from "../utils/response";
import { asyncHandler } from "../utils/async-handler";

export const facebookController = {
  // GET /api/facebook/auth?userId=xxx  →  redirect to Facebook OAuth
  auth: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: "userId required" });
    const url = facebookService.getAuthUrl(userId);
    res.redirect(url);
  }),

  // GET /api/facebook/callback?code=xxx&state=userId
  callback: asyncHandler(async (req: Request, res: Response) => {
    const { code, state: userId, error } = req.query as Record<string, string>;
    if (error || !code || !userId) {
      return res.redirect(`${process.env.BASE_URL ?? ""}/?fbError=1`);
    }
    await facebookService.handleCallback(code, userId);
    res.redirect(`${process.env.BASE_URL ?? ""}/?fbConnected=1`);
  }),

  // GET /api/facebook/webhook  →  verify webhook
  verifyWebhook: (req: Request, res: Response) => {
    const mode = req.query["hub.mode"] as string;
    const token = req.query["hub.verify_token"] as string;
    const challenge = req.query["hub.challenge"] as string;
    try {
      const result = facebookService.verifyWebhook(mode, token, challenge);
      res.status(200).type("text/plain").send(result);
    } catch {
      res.status(403).type("text/plain").send("Forbidden");
    }
  },

  // POST /api/facebook/webhook  →  receive events
  receiveWebhook: asyncHandler(async (req: Request, res: Response) => {
    await facebookService.handleWebhookEvent(req.body);
    res.sendStatus(200);
  }),

  // GET /api/facebook/pages?userId=xxx
  getPages: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: "userId required" });
    const pages = await facebookService.getPages(userId);
    return successResponse(res, pages, "Pages retrieved");
  }),

  // DELETE /api/facebook/pages/:id
  disconnectPage: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: "userId required" });
    await facebookService.disconnectPage(req.params.id, userId);
    res.sendStatus(204);
  }),

  // GET /api/facebook/pages/:id/conversations
  getConversations: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: "userId required" });
    const conversations = await facebookService.getConversations(req.params.id, userId);
    return successResponse(res, conversations, "Conversations retrieved");
  }),

  // GET /api/facebook/conversations/:conversationId/messages?pageId=xxx&userId=xxx
  getMessages: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    const pageId = req.query.pageId as string;
    if (!userId || !pageId) return res.status(400).json({ message: "userId and pageId required" });
    const messages = await facebookService.getMessages(req.params.conversationId, pageId, userId);
    return successResponse(res, messages, "Messages retrieved");
  }),

  // POST /api/facebook/pages/:id/send
  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    const { recipientId, text } = req.body as { recipientId: string; text: string };
    if (!userId) return res.status(400).json({ message: "userId required" });
    await facebookService.sendMessage(req.params.id, recipientId, text, userId);
    return successResponse(res, null, "Message sent");
  }),
};
