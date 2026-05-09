import { Request, Response, NextFunction } from 'express';

export function orgBranchScope(req: Request, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  const role: string = user?.role ?? '';

  if (role === 'platform_admin') {
    req.orgId    = '';
    req.branchId = null;
    req.orgRole  = 'platform_admin';
    return next();
  }

  const orgId: string | undefined = user?.org_id;
  if (!orgId) {
    res.status(403).json({ message: 'No organisation context' });
    return;
  }

  req.orgId    = orgId;
  req.branchId = user?.branch_id ?? null;
  req.orgRole  = user?.org_role ?? 'agent';
  next();
}
