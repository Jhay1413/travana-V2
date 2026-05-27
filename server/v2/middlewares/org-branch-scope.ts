import { Request, Response, NextFunction } from 'express';
import { authStorage } from './auth/storage';
import { branchMemberRepository } from '../modules/branch-member/branch-member.repository';
import { userOrgRolesRepository } from '../modules/user-org-roles/user-org-roles.repository';
import { primaryRole } from '../modules/user-org-roles/user-org-roles.service';
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
    // Impersonating: scope the request to the target org as if we were an org_admin there.
    // This makes tenant services apply org filtering instead of the cross-tenant
    // short-circuit (e.g. booking.service.ts effectiveOrgId).
    const impersonateOrgId = req.session?.impersonateOrgId;
    if (impersonateOrgId) {
      req.orgId    = impersonateOrgId;
      req.branchId = null;
      req.orgRoles = ['org_admin'];
      req.orgRole  = 'org_admin';
      return next();
    }

    req.orgId    = '';
    req.branchId = null;
    req.orgRoles = ['platform_admin'];
    req.orgRole  = 'platform_admin';
    return next();
  }

  const membership = await branchMemberRepository.findActiveByUserId(userId);
  const orgId      = membership?.orgId ?? dbUser.orgId ?? null;

  if (!orgId) {
    res.status(403).json({ message: 'No organisation context' });
    return;
  }

  // Effective roles = junction-table set ∪ active branch membership role.
  // Fall back to legacy user.orgRole if the junction is somehow empty (backfill
  // should have prevented this, but stay defensive for edge cases).
  const fromJunction = await userOrgRolesRepository.findRolesByUserAndOrg(userId, orgId);
  const roleSet      = new Set<string>(fromJunction);
  if (membership?.orgRole) roleSet.add(membership.orgRole);
  if (roleSet.size === 0 && dbUser.orgRole) roleSet.add(dbUser.orgRole);

  const roles = Array.from(roleSet);
  req.orgId    = orgId;
  req.branchId = membership?.branchId ?? null;
  req.orgRoles = roles;
  req.orgRole  = primaryRole(roles) ?? (dbUser.orgRole ?? '');
  return next();
}
