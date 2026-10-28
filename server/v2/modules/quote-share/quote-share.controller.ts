import { Request, Response } from 'express';
import { quoteShareService } from './quote-share.service';
import { quoteWhatsappService } from './quote-whatsapp.service';
import { quoteWhatsappSettingsService } from './quote-whatsapp-settings.service';
import type { QuoteTemplateSettings } from './quote-share.types';
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

export const quoteShareController = {
  getWhatsappTemplateSettings: asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const data = await quoteWhatsappSettingsService.get(orgId);
    return successResponse(res, data, 'WhatsApp template settings retrieved');
  }),

  saveWhatsappTemplateSettings: asyncHandler(async (req: Request, res: Response) => {
    const orgId = requireOrgId(req);
    const data = await quoteWhatsappSettingsService.save(orgId, req.body as QuoteTemplateSettings, getUserId(req));
    return successResponse(res, data, 'WhatsApp template settings saved');
  }),

  getClientViews: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const rows = await quoteShareService.getClientQuoteViews(req.params.clientId as string, getScope(req));
    return successResponse(res, rows, 'Client quote views retrieved');
  }),

  generateToken: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await quoteShareService.verifyAccess(req.params.id as string, userId, getScope(req));
    const token = await quoteShareService.generateToken(req.params.id as string);
    res.json({ success: true, data: { token } });
  }),

  getViews: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await quoteShareService.verifyAccess(req.params.id as string, userId, getScope(req), 'read');
    const stats = await quoteShareService.getViewStats(req.params.id as string);
    res.json({ success: true, data: stats });
  }),

  getCustomerActions: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await quoteShareService.verifyAccess(req.params.id as string, userId, getScope(req), 'read');
    const actions = await quoteShareService.getCustomerActions(req.params.id as string);
    res.json({ success: true, data: actions });
  }),

  sendWhatsapp: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { clientId } = req.body;
    const result = await quoteWhatsappService.send(req.params.id as string, clientId, userId, getScope(req));
    return successResponse(res, result, result.status === 'sent' ? 'Quote sent via WhatsApp' : 'WhatsApp fallback');
  }),

  updateSent: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await quoteShareService.verifyAccess(req.params.id as string, userId, getScope(req));
    const { sentVia } = req.body;
    await quoteShareService.updateSentInfo(req.params.id as string, sentVia);
    res.json({ success: true });
  }),
};
