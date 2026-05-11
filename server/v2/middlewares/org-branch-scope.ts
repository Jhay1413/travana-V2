import { Request, Response, NextFunction } from 'express';
import { authStorage } from './auth/storage';
import { branchMemberRepository } from '../modules/branch-member/branch-member.repository';
import { getUserId } from '../../utils/get-user-id';

export async function orgBranchScope(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionUser = (req as any).user;
  const userId = getUserId(req) ?? sessionUser?.userId ?? sessionUser?.id;

  if (!userId) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const dbUser = await authStorage.getUser(userId);
  if (!dbUser) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (dbUser.role === 'platform_admin') {
    req.orgId    = '';
    req.branchId = null;
    req.orgRole  = 'platform_admin';
    return next();
  }

  const membership = await branchMemberRepository.findActiveByUserId(userId);
  if (membership) {
    req.orgId    = membership.orgId;
    req.branchId = membership.branchId;
    req.orgRole  = membership.orgRole;
    return next();
  }

  if (dbUser.orgId) {
    req.orgId    = dbUser.orgId;
    req.branchId = null;
    req.orgRole  = dbUser.orgRole ?? 'org_admin';
    return next();
  }

  res.status(403).json({ message: 'No organisation context' });
}
