import { Request, Response } from 'express';
import { quoteShareService } from './quote-share.service';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';
import { getScope } from '../../utils/scope';
import { successResponse } from '../../utils/response';

export const quoteShareController = {
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
    await quoteShareService.verifyAccess(req.params.id as string, userId, getScope(req));
    const stats = await quoteShareService.getViewStats(req.params.id as string);
    res.json({ success: true, data: stats });
  }),

  getCustomerActions: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    await quoteShareService.verifyAccess(req.params.id as string, userId, getScope(req));
    const actions = await quoteShareService.getCustomerActions(req.params.id as string);
    res.json({ success: true, data: actions });
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
