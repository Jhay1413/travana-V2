import { Request, Response } from 'express';
import { whatsappUpdatesService } from './whatsapp-updates.service';
import type { UpdateTemplateSettings } from './whatsapp-updates.types';
import { AppError } from '../../utils/error-handler';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';
import { getScope } from '../../utils/scope';
import { successResponse } from '../../utils/response';

function requireOrgId(req: Request): string {
  const orgId = getScope(req).orgId;
  if (!orgId) throw new AppError('No organisation in scope', 400);
  return orgId;
}

export const whatsappUpdatesController = {
  getSettings: asyncHandler(async (req: Request, res: Response) => {
    const data = await whatsappUpdatesService.getSettings(requireOrgId(req));
    return successResponse(res, data, 'General update template settings retrieved');
  }),

  saveSettings: asyncHandler(async (req: Request, res: Response) => {
    const data = await whatsappUpdatesService.saveSettings(requireOrgId(req), req.body as UpdateTemplateSettings, getUserId(req));
    return successResponse(res, data, 'General update template settings saved');
  }),

  getTemplate: asyncHandler(async (req: Request, res: Response) => {
    const data = await whatsappUpdatesService.getTemplateStatus(requireOrgId(req));
    return successResponse(res, data, 'General update template retrieved');
  }),

  getWindow: asyncHandler(async (req: Request, res: Response) => {
    const data = await whatsappUpdatesService.getWindow(req.params.conversationId as string);
    return successResponse(res, data, 'WhatsApp window retrieved');
  }),

  sendToConversation: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { text } = req.body as { text: string };
    const data = await whatsappUpdatesService.sendToConversation(req.params.conversationId as string, text, userId, getScope(req));
    return successResponse(res, data, data.viaTemplate ? 'Update sent as a template' : 'Message sent');
  }),

  sendToClient: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { channelId, text } = req.body as { channelId: string; text: string };
    const data = await whatsappUpdatesService.sendToClient(req.params.clientId as string, channelId, text, userId, getScope(req));
    return successResponse(res, data, data.viaTemplate ? 'Update sent as a template' : 'Message sent');
  }),
};
