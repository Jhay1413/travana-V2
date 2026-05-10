import { Request, Response, NextFunction } from 'express';
import { authStorage } from '../../replit_integrations/auth/storage';
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

  const role: string = (dbUser as any).role ?? '';
  if (role === 'platform_admin') {
    req.orgId    = '';
    req.branchId = null;
    req.orgRole  = 'platform_admin';
    return next();
  }

  const orgId: string | undefined = (dbUser as any).org_id;
  if (!orgId) {
    res.status(403).json({ message: 'No organisation context' });
    return;
  }

  req.orgId    = orgId;
  req.branchId = (dbUser as any).branch_id ?? null;
  req.orgRole  = (dbUser as any).org_role ?? 'agent';
  next();
}
