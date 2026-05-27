import { db } from '../../config/database';
import { user } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../../utils/error-handler';
import { userOrgRolesRepository } from './user-org-roles.repository';
import { branchMemberRepository } from '../branch-member/branch-member.repository';
import { platformAdminAuditRepository } from '../platform-admin/platform-admin-audit.repository';

/**
 * Role ranking — used to derive a single "primary" role from a user's role set
 * so legacy single-role call sites (e.g. req.orgRole, /api/auth/user.orgRole)
 * keep working. Higher number = more powerful.
 *
 * platform_admin is NOT here; it lives on user.role (cross-tenant), not in
 * user_org_roles, and is handled separately in middleware.
 */
const ROLE_RANK: Record<string, number> = {
  org_admin:      100,
  branch_manager:  80,
  agent:           60,
  homeworker:      40,
  referral_agent:  20,
};

const INTERNAL_ROLES = new Set(['org_admin', 'branch_manager', 'agent', 'homeworker']);

export function primaryRole(roles: string[]): string | null {
  if (roles.length === 0) return null;
  return roles
    .slice()
    .sort((a, b) => (ROLE_RANK[b] ?? 0) - (ROLE_RANK[a] ?? 0))[0];
}

export interface RoleChangeActor {
  userId:    string;
  ipAddress: string | null;
  userAgent: string | null;
}

async function recordAudit(params: {
  actor:        RoleChangeActor;
  action:       'user.role.add' | 'user.role.remove';
  targetOrgId:  string;
  targetUserId: string;
  metadata?:    Record<string, unknown>;
}): Promise<void> {
  try {
    await platformAdminAuditRepository.create({
      actorUserId:  params.actor.userId,
      action:       params.action,
      targetOrgId:  params.targetOrgId,
      targetUserId: params.targetUserId,
      metadata:     params.metadata ?? {},
      ipAddress:    params.actor.ipAddress,
      userAgent:    params.actor.userAgent,
    });
  } catch (err) {
    // Mutation already committed — log and move on rather than rolling back
    // the user-visible action over an audit-write failure.
    console.error('[user-org-roles] audit write failed:', err);
  }
}

function assertCompatibleRoleSet(roles: string[]): void {
  const hasReferral = roles.includes('referral_agent');
  const hasInternal = roles.some((r) => INTERNAL_ROLES.has(r));
  if (hasReferral && hasInternal) {
    throw new AppError(
      'referral_agent cannot be combined with internal roles (org_admin, branch_manager, agent, homeworker)',
      400,
    );
  }
}

export const userOrgRolesService = {
  /** Read the union of a user's org roles. */
  async listForUser(userId: string, orgId: string): Promise<string[]> {
    return userOrgRolesRepository.findRolesByUserAndOrg(userId, orgId);
  },

  /**
   * Add a role to a user. Idempotent — adding a role they already have is a
   * no-op (no audit row). Validates compatibility, recomputes user.orgRole to
   * the new primary, and writes an audit row.
   */
  async addRole(
    userId: string,
    orgId: string,
    newRole: string,
    actor: RoleChangeActor,
  ): Promise<void> {
    if (ROLE_RANK[newRole] === undefined) {
      throw new AppError('Invalid role', 400);
    }
    const existing = await userOrgRolesRepository.findRolesByUserAndOrg(userId, orgId);
    if (existing.includes(newRole)) return; // idempotent

    assertCompatibleRoleSet([...existing, newRole]);

    await userOrgRolesRepository.addRole({
      userId,
      orgId,
      role: newRole,
      grantedBy: actor.userId,
    });

    // Recompute primary and sync the legacy user.orgRole column so single-role
    // call sites stay correct.
    const newPrimary = primaryRole([...existing, newRole]);
    if (newPrimary) {
      await db
        .update(user)
        .set({ orgRole: newPrimary, updatedAt: new Date() })
        .where(eq(user.id, userId));
    }

    await recordAudit({
      actor,
      action: 'user.role.add',
      targetOrgId: orgId,
      targetUserId: userId,
      metadata: { role: newRole, primary: newPrimary },
    });
  },

  /**
   * Remove a role from a user. Refuses to remove the last role. Recomputes
   * user.orgRole to the new primary and writes an audit row.
   */
  async removeRole(
    userId: string,
    orgId: string,
    roleToRemove: string,
    actor: RoleChangeActor,
  ): Promise<void> {
    const existing = await userOrgRolesRepository.findRolesByUserAndOrg(userId, orgId);
    if (!existing.includes(roleToRemove)) return; // idempotent

    const remaining = existing.filter((r) => r !== roleToRemove);

    // "Last role" check must consider every source of access, not just
    // user_org_roles rows. A branch_manager who toggled "also sell" has only
    // `agent` in user_org_roles but still holds branch_manager via
    // branch_members.orgRole — removing agent does not leave them roleless.
    if (remaining.length === 0) {
      const [membership, userRow] = await Promise.all([
        branchMemberRepository.findActiveByUserId(userId),
        db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1),
      ]);
      const hasMembershipRole = membership?.orgId === orgId && !!membership.orgRole;
      const isPlatformAdmin = userRow[0]?.role === 'platform_admin';
      if (!hasMembershipRole && !isPlatformAdmin) {
        throw new AppError('Cannot remove the user\'s last role', 400);
      }
    }

    await userOrgRolesRepository.removeRole(userId, orgId, roleToRemove);
    const newPrimary = primaryRole(remaining);
    if (newPrimary) {
      await db
        .update(user)
        .set({ orgRole: newPrimary, updatedAt: new Date() })
        .where(eq(user.id, userId));
    }

    await recordAudit({
      actor,
      action: 'user.role.remove',
      targetOrgId: orgId,
      targetUserId: userId,
      metadata: { role: roleToRemove, primary: newPrimary },
    });
  },
};
