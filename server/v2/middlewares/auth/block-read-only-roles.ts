import type { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isReadOnlyRole(req: Request): boolean {
  return req.orgRole === 'social_media_manager';
}

/**
 * social_media_manager is read-only on client data (clients, their files and
 * portal PIN, deals, notes, tasks, tickets, contact links). Checks the PRIMARY
 * role only: a user who also holds a higher-ranked role has that role as
 * primary and keeps write access, while an unknown/empty role is left to the
 * existing handlers (behaviour unchanged for everyone else).
 *
 * Unconditional: use on an individual write route.
 */
export function blockReadOnlyClientRoles(req: Request, res: Response, next: NextFunction): void {
  if (isReadOnlyRole(req)) {
    res.status(403).json({ message: 'You do not have permission to modify clients' });
    return;
  }
  next();
}

/**
 * Method-aware variant for `router.use(...)`: reads pass, every write method
 * (POST/PUT/PATCH/DELETE) is refused for read-only roles. Applying it at router
 * level means routes added later are protected by default.
 */
export function blockReadOnlyClientWrites(req: Request, res: Response, next: NextFunction): void {
  if (!SAFE_METHODS.has(req.method) && isReadOnlyRole(req)) {
    res.status(403).json({ message: 'You do not have permission to modify clients' });
    return;
  }
  next();
}
