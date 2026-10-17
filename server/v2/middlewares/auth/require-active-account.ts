import type { Request, Response, NextFunction } from 'express';
import { authStorage } from './storage';
import { getUserId } from '../../utils/get-user-id';
import { rejectBlockedSession } from './account-standing';
import { resolveAccountBlock } from './resolve-account-block';

/**
 * For routes behind isAuthenticated that do not go through orgBranchScope (the
 * /api/auth self-service handlers): a deactivated or suspended account loses its
 * session instead of changing its password, profile or avatar.
 */
export async function requireActiveAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const dbUser = await authStorage.getUser(userId);
    if (!dbUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const block = await resolveAccountBlock(dbUser, false);
    if (block) {
      rejectBlockedSession(req, res, block);
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
