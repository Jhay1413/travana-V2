import { Request, Response } from 'express';
import { facebookService } from './facebook.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../utils/get-user-id';

function requireUserId(req: Request): string {
  const userId = getUserId(req);
  if (!userId) {
    throw new AppError('Unauthorized', 401);
  }
  return userId;
}

export const facebookController = {
  // Auth + callback are public — they bridge to FB's OAuth.
  auth: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const url = facebookService.getAuthUrl(userId);
    res.redirect(url);
  }),

  callback: asyncHandler(async (req: Request, res: Response) => {
    const { code, state: userId, error } = req.query as Record<string, string>;
    if (error || !code || !userId) {
      return res.redirect(`${process.env.BASE_URL ?? ''}/?fbError=1`);
    }
    await facebookService.handleCallback(code, userId);
    res.redirect(`${process.env.BASE_URL ?? ''}/?fbConnected=1`);
  }),

  verifyWebhook: (req: Request, res: Response) => {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;
    const expected = process.env.FACEBOOK_VERIFY_TOKEN;
    if (mode === 'subscribe' && token === expected) {
      return res.status(200).type('text/plain').send(challenge);
    }
    res.status(403).type('text/plain').send('Forbidden');
  },

  receiveWebhook: asyncHandler(async (req: Request, res: Response) => {
    await facebookService.handleWebhookEvent(req.body);
    res.sendStatus(200);
  }),

  // All authenticated endpoints below resolve userId from the session — never from query.

  getPages: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const pages = await facebookService.getPages(userId);
    return successResponse(res, pages, 'Pages retrieved');
  }),

  disconnectPage: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    await facebookService.disconnectPage(req.params.id, userId);
    res.sendStatus(204);
  }),

  getConversations: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const conversations = await facebookService.getConversations(req.params.id, userId);
    return successResponse(res, conversations, 'Conversations retrieved');
  }),

  getMessages: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const pageId = req.query.pageId as string;
    if (!pageId) return res.status(400).json({ message: 'pageId required' });
    const messages = await facebookService.getMessages(req.params.conversationId, pageId, userId);
    return successResponse(res, messages, 'Messages retrieved');
  }),

  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { recipientId, text } = req.body as { recipientId: string; text: string };
    await facebookService.sendMessage(req.params.id, recipientId, text, userId);
    return successResponse(res, null, 'Message sent');
  }),
};
