import { Request, Response } from 'express';
import { quoteShareService } from './quote-share.service';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';
import { db } from '../../config/database';
import { user as userTable } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function getUserRole(userId: string): Promise<string> {
  const [u] = await db.select({ role: userTable.role }).from(userTable).where(eq(userTable.id, userId)).limit(1);
  return u?.role?.toLowerCase() || '';
}

export const quoteShareController = {
  generateToken: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const role = await getUserRole(userId);
    await quoteShareService.verifyAccess(req.params.id, userId, role);
    const token = await quoteShareService.generateToken(req.params.id);
    res.json({ success: true, data: { token } });
  }),

  getViews: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const role = await getUserRole(userId);
    await quoteShareService.verifyAccess(req.params.id, userId, role);
    const stats = await quoteShareService.getViewStats(req.params.id);
    res.json({ success: true, data: stats });
  }),

  getCustomerActions: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const role = await getUserRole(userId);
    await quoteShareService.verifyAccess(req.params.id, userId, role);
    const actions = await quoteShareService.getCustomerActions(req.params.id);
    res.json({ success: true, data: actions });
  }),

  updateSent: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const role = await getUserRole(userId);
    await quoteShareService.verifyAccess(req.params.id, userId, role);
    const { sentVia } = req.body;
    await quoteShareService.updateSentInfo(req.params.id, sentVia);
    res.json({ success: true });
  }),
};
