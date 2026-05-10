import { Request, Response, NextFunction } from 'express';
import type { OrgRole } from '../../utils/scope';

export function requireOrgRole(allowed: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req.orgRole ?? '') as OrgRole;
    if (!allowed.includes(role)) {
      res.status(403).json({ message: 'You do not have permission to perform this action' });
      return;
    }
    next();
  };
}
