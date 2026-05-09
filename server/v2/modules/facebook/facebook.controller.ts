import { Request, Response } from 'express';
import { facebookService } from './facebook.service';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';

export const facebookController = {
  auth: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: 'userId required' });
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

  getPages: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const pages = await facebookService.getPages(userId);
    return successResponse(res, pages, 'Pages retrieved');
  }),

  disconnectPage: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    await facebookService.disconnectPage(req.params.id, userId);
    res.sendStatus(204);
  }),

  getConversations: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ message: 'userId required' });
    const conversations = await facebookService.getConversations(req.params.id, userId);
    return successResponse(res, conversations, 'Conversations retrieved');
  }),

  getMessages: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    const pageId = req.query.pageId as string;
    if (!userId || !pageId) return res.status(400).json({ message: 'userId and pageId required' });
    const messages = await facebookService.getMessages(req.params.conversationId, pageId, userId);
    return successResponse(res, messages, 'Messages retrieved');
  }),

  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const userId = req.query.userId as string;
    const { recipientId, text } = req.body as { recipientId: string; text: string };
    if (!userId) return res.status(400).json({ message: 'userId required' });
    await facebookService.sendMessage(req.params.id, recipientId, text, userId);
    return successResponse(res, null, 'Message sent');
  }),
};
