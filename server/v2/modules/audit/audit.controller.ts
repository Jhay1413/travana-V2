import { Request, Response } from 'express';
import { auditService } from './audit.service';
import { userRepository } from '../user/user.repository';
import { asyncHandler } from '../../utils/async-handler';
import { AppError } from '../../utils/error-handler';
import { getUserId } from '../../utils/get-user-id';
import { getScope } from '../../utils/scope';

async function requirePerformer(req: Request) {
  const userId = getUserId(req);
  if (!userId) throw new AppError('Not authenticated', 401);
  const userRecord = await userRepository.findById(userId);
  if (!userRecord) throw new AppError('Not authenticated', 401);
  return {
    userId,
    name: userRecord.name || userRecord.email || 'Unknown',
  };
}

export const auditController = {
  getAll: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const logs = await auditService.findAll(scope);
    res.json({ success: true, data: logs });
  }),

  deleteQuote: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const performer = await requirePerformer(req);

    const id = req.params.id as string;
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason) return res.status(400).json({ success: false, error: 'Reason is required' });

    await auditService.deleteQuote(scope, {
      id,
      reason,
      performedBy: performer.userId,
      performedByName: performer.name,
    });
    res.json({ success: true, message: 'Quote deleted successfully' });
  }),

  deleteBooking: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const performer = await requirePerformer(req);

    const id = req.params.id as string;
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason) return res.status(400).json({ success: false, error: 'Reason is required' });

    await auditService.deleteBooking(scope, {
      id,
      reason,
      performedBy: performer.userId,
      performedByName: performer.name,
    });
    res.json({ success: true, message: 'Booking deleted successfully' });
  }),
};
