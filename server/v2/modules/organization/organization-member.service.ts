import { db } from '../../config/database';
import { user, branches as branchesTable } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { AppError } from '../../utils/error-handler';
import { branchMemberRepository } from '../branch-member/branch-member.repository';

const ALLOWED_ORG_ROLES = ['org_admin', 'branch_manager', 'agent', 'homeworker', 'referral_agent'] as const;
type OrgRole = (typeof ALLOWED_ORG_ROLES)[number];

function assertRole(role: string): asserts role is OrgRole {
  if (!ALLOWED_ORG_ROLES.includes(role as OrgRole)) {
    throw new AppError(`Invalid org role: ${role}`, 400);
  }
}

export const orgMemberService = {
  async list(orgId: string) {
    return branchMemberRepository.listOrgMembersWithBranches(orgId);
  },

  async updateRole(orgId: string, userId: string, newRole: string, actingUserId: string | null) {
    assertRole(newRole);
    if (actingUserId === userId && newRole !== 'org_admin') {
      throw new AppError('You cannot demote yourself', 400);
    }

    const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!target || target.orgId !== orgId) {
      throw new AppError('Member not found in this organisation', 404);
    }

    await db.transaction(async (tx) => {
      await tx.update(user).set({ orgRole: newRole, updatedAt: new Date() }).where(eq(user.id, userId));
      await branchMemberRepository.setRoleForUser(orgId, userId, newRole, tx);
    });

    return { userId, orgRole: newRole };
  },

  async setSuspended(orgId: string, userId: string, suspended: boolean, actingUserId: string | null) {
    if (actingUserId === userId) {
      throw new AppError('You cannot suspend your own account', 400);
    }

    const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!target || target.orgId !== orgId) {
      throw new AppError('Member not found in this organisation', 404);
    }

    await branchMemberRepository.setActiveForUser(orgId, userId, !suspended);
    return { userId, suspended };
  },

  async assignToBranch(orgId: string, userId: string, branchId: string, role?: string) {
    const [target] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!target || target.orgId !== orgId) {
      throw new AppError('Member not found in this organisation', 404);
    }
    const [branch] = await db
      .select()
      .from(branchesTable)
      .where(and(eq(branchesTable.id, branchId), eq(branchesTable.organizationId, orgId)))
      .limit(1);
    if (!branch) throw new AppError('Branch not found', 404);

    const existing = await branchMemberRepository.findByUserAndBranch(userId, branchId);
    if (existing) {
      throw new AppError('Member is already assigned to this branch', 409);
    }

    const orgRole = role ?? target.orgRole ?? 'agent';
    assertRole(orgRole);
    return branchMemberRepository.create({ orgId, branchId, userId, orgRole, isActive: true });
  },

  async unassignFromBranch(orgId: string, userId: string, branchId: string) {
    const [branch] = await db
      .select()
      .from(branchesTable)
      .where(and(eq(branchesTable.id, branchId), eq(branchesTable.organizationId, orgId)))
      .limit(1);
    if (!branch) throw new AppError('Branch not found', 404);

    await branchMemberRepository.removeFromBranch(branchId, userId);
  },
};
