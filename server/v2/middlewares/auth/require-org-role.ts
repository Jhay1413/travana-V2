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

/**
 * Like requireOrgRole but checks the caller's full role union, so a role held
 * below the primary (e.g. homeworker alongside agent) still passes.
 */
export function requireAnyOrgRole(allowed: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const roles = (req.orgRoles && req.orgRoles.length > 0 ? req.orgRoles : [req.orgRole ?? '']) as OrgRole[];
    if (!roles.some((r) => allowed.includes(r))) {
      res.status(403).json({ message: 'You do not have permission to perform this action' });
      return;
    }
    next();
  };
}

/** Inverse of requireOrgRole: returns 403 when the caller's org role is in `denied`. */
export function denyOrgRole(denied: OrgRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check the full role union so a lower-ranked denied role (e.g. homeworker
    // alongside agent) cannot hide behind a higher-ranked primary role.
    const roles = (req.orgRoles && req.orgRoles.length > 0 ? req.orgRoles : [req.orgRole ?? '']) as OrgRole[];
    if (roles.some((r) => denied.includes(r))) {
      res.status(403).json({ message: 'You do not have permission to access this resource' });
      return;
    }
    next();
  };
}
