import { Request, Response } from 'express';
import { quoteShareService } from './quote-share.service';
import { userRepository } from '../user/user.repository';
import { asyncHandler } from '../../utils/async-handler';
import { getUserId } from '../../utils/get-user-id';

async function getUserRole(userId: string): Promise<string> {
  const u = await userRepository.findRoleById(userId);
  return u?.role?.toLowerCase() || '';
}

export const quoteShareController = {
  generateToken: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const role = await getUserRole(userId);
    await quoteShareService.verifyAccess(req.params.id as string, userId, role);
    const token = await quoteShareService.generateToken(req.params.id as string);
    res.json({ success: true, data: { token } });
  }),

  getViews: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const role = await getUserRole(userId);
    await quoteShareService.verifyAccess(req.params.id as string, userId, role);
    const stats = await quoteShareService.getViewStats(req.params.id as string);
    res.json({ success: true, data: stats });
  }),

  getCustomerActions: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const role = await getUserRole(userId);
    await quoteShareService.verifyAccess(req.params.id as string, userId, role);
    const actions = await quoteShareService.getCustomerActions(req.params.id as string);
    res.json({ success: true, data: actions });
  }),

  updateSent: asyncHandler(async (req: Request, res: Response) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const role = await getUserRole(userId);
    await quoteShareService.verifyAccess(req.params.id as string, userId, role);
    const { sentVia } = req.body;
    await quoteShareService.updateSentInfo(req.params.id as string, sentVia);
    res.json({ success: true });
  }),
};
