import type { Request, Response, NextFunction } from 'express';
import { authStorage } from './storage';
import { getUserId } from '../../utils/get-user-id';

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
  if (!dbUser || dbUser.role !== 'platform_admin') {
    res.status(403).json({ message: 'Platform admin required' });
    return;
  }

  next();
}
