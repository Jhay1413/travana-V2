import type { Request, Response, NextFunction } from 'express';
import { authStorage } from './storage';
import { getUserId } from '../../utils/get-user-id';
import { accountBlock, rejectBlockedSession } from './account-standing';

export async function requirePlatformAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const dbUser = await authStorage.getUser(userId);
  // A deactivated platform admin loses access and the session.
  const block = dbUser ? accountBlock(dbUser, null) : null;
  if (block) {
    rejectBlockedSession(req, res, block);
    return;
  }

  if (!dbUser || dbUser.role !== 'platform_admin') {
    res.status(403).json({ message: 'Platform admin required' });
    return;
  }

  next();
}
