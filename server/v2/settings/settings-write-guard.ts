import type { Request, Response, NextFunction } from 'express';
import type { OrgRole } from '../utils/scope';

/** Shared reference data is changed by agency owners and platform admins only. */
export const ADMIN_ROLES: OrgRole[] = ['org_admin', 'platform_admin'];

/**
 * Everyday screens (quote, booking and enquiry forms) quick-add a missing
 * destination, resort, accommodation etc. These exact writes stay open to the
 * staff who use those forms; everything else needs an admin role.
 */
export const EVERYDAY_WRITER_ROLES: OrgRole[] = ['org_admin', 'platform_admin', 'branch_manager', 'agent', 'homeworker'];

interface EverydayWrite {
  methods: string[];
  path: RegExp;
}

export const EVERYDAY_WRITES: EverydayWrite[] = [
  // Quick-add modals in features/lookups (add-*-modal.tsx).
  { methods: ['POST'], path: /^\/(accommodations|board-basis|countries|destinations|lodges|resorts|room-types)\/?$/ },
  // Tags tolerate no everyday write here: tags are global, so rename and delete are admin-only.
  // Everyday staff detach a tag from their own quote via DELETE /quotes/:id/tags/:tagId.
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Router-level guard for /settings: reads are open to any signed-in staff, writes
 * need an admin role unless they are one of the everyday quick-adds. Mounted behind
 * orgBranchScope, so req.orgRoles is the caller's full role union.
 */
export function settingsWriteGuard(req: Request, res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const roles = (req.orgRoles && req.orgRoles.length > 0 ? req.orgRoles : [req.orgRole ?? '']) as OrgRole[];
  const everyday = EVERYDAY_WRITES.some((w) => w.methods.includes(req.method) && w.path.test(req.path));
  const allowed = everyday ? EVERYDAY_WRITER_ROLES : ADMIN_ROLES;
  if (!roles.some((r) => allowed.includes(r))) {
    res.status(403).json({ message: 'You do not have permission to perform this action' });
    return;
  }
  next();
}
