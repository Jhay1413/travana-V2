import { AppError } from '../../utils/error-handler';
import type { RequestActor } from '../../utils/request-actor';
import { isRemovedUser } from '../../utils/removed-user';
import { branchMemberRepository } from '../branch-member/branch-member.repository';
import { branchRepository } from '../branch/branch.repository';
import { userRepository } from '../user/user.repository';
import { userAccessService } from '../user/user-access.service';
import { homeworkerService } from '../homeworker/homeworker.service';
import { userOrgRolesRepository } from '../user-org-roles/user-org-roles.repository';
import { organizationRepository } from './organization.repository';
import { organizationAuditService } from './organization-audit.service';
import { organizationSeatService } from './organization-seat.service';
import { sendSuspensionEmail } from './organization-member-email.service';
import { assertNoHomeworkerRoleChange, HOMEWORKER_INVITE_ONLY_MESSAGE } from '../../utils/homeworker-role';
import type { MemberProfilePatch } from './organization.types';

const ALLOWED_ORG_ROLES = ['org_admin', 'branch_manager', 'agent', 'homeworker', 'referral_agent', 'social_media_manager'] as const;
type OrgRole = (typeof ALLOWED_ORG_ROLES)[number];

function assertRole(role: string): asserts role is OrgRole {
  if (!ALLOWED_ORG_ROLES.includes(role as OrgRole)) {
    throw new AppError(`Invalid org role: ${role}`, 400);
  }
}

async function findMemberInOrg(userId: string, orgId: string) {
  const target = await userRepository.findById(userId);
  if (!target || target.orgId !== orgId) {
    throw new AppError('Member not found in this organisation', 404);
  }
  return target;
}

function assertNotRemoved(target: { banned?: boolean | null; banReason?: string | null }): void {
  if (isRemovedUser(target)) throw new AppError('This member has been removed', 409);
}

/** Platform admins are managed only from the platform-admin console. */
function assertNotPlatformAdmin(target: { role?: string | null }): void {
  if (target.role === 'platform_admin') {
    throw new AppError('Platform admins cannot be managed here', 403);
  }
}

/** Referral partners use no seat: true when every role the person holds is referral_agent. */
function isReferralOnly(roles: string[]): boolean {
  return roles.length > 0 && roles.every((r) => r === 'referral_agent');
}

/** Full role union: junction rows plus the primary role (catches a legacy {agent, homeworker} user). */
async function loadRoleUnion(userId: string, orgId: string, primary: string | null): Promise<string[]> {
  const junction = await userOrgRolesRepository.findRolesByUserAndOrg(userId, orgId);
  return primary ? [...junction, primary] : junction;
}

/** Suspended = has memberships and none is active. */
async function isCurrentlySuspended(userId: string): Promise<boolean> {
  const standing = await branchMemberRepository.findStandingByUserId(userId);
  return standing.total > 0 && standing.active === 0;
}

export const orgMemberService = {
  async list(orgId: string) {
    return branchMemberRepository.listOrgMembersWithBranches(orgId);
  },

  async updateRole(orgId: string, userId: string, newRole: string, actor: RequestActor) {
    assertRole(newRole);
    if (actor.userId === userId && newRole !== 'org_admin') {
      throw new AppError('You cannot demote yourself', 400);
    }

    const target = await findMemberInOrg(userId, orgId);
    assertNotPlatformAdmin(target);
    assertNotRemoved(target);
    const held = await loadRoleUnion(userId, orgId, target.orgRole ?? null);
    assertNoHomeworkerRoleChange(held, newRole);
    // A referral partner holds no seat; turning them into an internal role takes one.
    // Only a genuinely suspended, accepted member is exempt: a pending invite already holds a seat slot.
    if (
      isReferralOnly(held) && newRole !== 'referral_agent' &&
      (target.inviteToken || !(await isCurrentlySuspended(userId)))
    ) {
      await organizationSeatService.assertSeatAvailable(orgId);
    }
    await branchMemberRepository.setOrgRoleAtomic(orgId, userId, newRole);

    await organizationAuditService.record({
      actor, action: 'member.role.change', orgId, targetUserId: userId,
      metadata: { from: target.orgRole ?? null, to: newRole },
    });
    return { userId, orgRole: newRole };
  },

  async setSuspended(orgId: string, userId: string, suspended: boolean, actor: RequestActor, notify = false) {
    if (actor.userId === userId) {
      throw new AppError('You cannot suspend your own account', 400);
    }

    const target = await findMemberInOrg(userId, orgId);
    assertNotPlatformAdmin(target);
    assertNotRemoved(target);
    if (target.inviteToken) {
      throw new AppError('This person has not accepted their invite yet; revoke the invite instead', 400);
    }
    // With no membership rows there is nothing to switch off, so the suspension would block nothing.
    if (suspended && (await branchMemberRepository.findStandingByUserId(userId)).total === 0) {
      throw new AppError('Assign this member to a branch before suspending', 400);
    }

    if (!suspended) {
      // An archived homeworker is offboarded: reactivating would restore access to a closed branch.
      await homeworkerService.assertNotArchived(orgId, userId);
      // Reactivating takes a seat back (referral partners never held one). Re-confirming an
      // already-active member changes nothing, so it is not seat-checked.
      if (await isCurrentlySuspended(userId)) {
        const roles = await loadRoleUnion(userId, orgId, target.orgRole ?? null);
        if (!isReferralOnly(roles)) await organizationSeatService.assertSeatAvailable(orgId);
      }
    }

    await branchMemberRepository.setActiveForUser(orgId, userId, !suspended);

    let sessionsDeleted = 0;
    if (suspended) {
      // The change is committed; now end live sessions and realtime streams so access stops at once.
      sessionsDeleted = await userAccessService.revokeAccess(userId);
      if (notify) {
        const org = await organizationRepository.findById(orgId);
        await sendSuspensionEmail(target.email, org?.name ?? 'your agency');
      }
    }

    await organizationAuditService.record({
      actor, action: suspended ? 'member.suspend' : 'member.reactivate', orgId, targetUserId: userId,
      metadata: suspended ? { notified: notify, sessionsDeleted } : {},
    });
    return { userId, suspended };
  },

  async assignToBranch(orgId: string, userId: string, branchId: string, role: string | undefined, actor: RequestActor) {
    const target = await findMemberInOrg(userId, orgId);
    assertNotPlatformAdmin(target);
    assertNotRemoved(target);
    const branch = await branchRepository.findById(branchId, orgId);
    if (!branch) throw new AppError('Branch not found', 404);

    // Homeworker branches are created by invite and hold only their owner.
    if (branch.branchType === 'homeworker') {
      throw new AppError(HOMEWORKER_INVITE_ONLY_MESSAGE, 400);
    }

    const existing = await branchMemberRepository.findByUserAndBranch(userId, branchId);
    if (existing) {
      throw new AppError('Member is already assigned to this branch', 409);
    }

    const orgRole = role ?? target.orgRole ?? 'agent';
    assertRole(orgRole);
    // A membership row must never carry a different role than the user's own, or the
    // auth-time role union would grant both; and a homeworker owns exactly one branch.
    assertNoHomeworkerRoleChange(await loadRoleUnion(userId, orgId, target.orgRole ?? null), orgRole);
    if (orgRole === 'homeworker') {
      throw new AppError(HOMEWORKER_INVITE_ONLY_MESSAGE, 400);
    }

    // A suspended member (or one still on an invite) must not be reactivated by a new membership.
    const inactive = Boolean(target.inviteToken) || (await isCurrentlySuspended(userId));
    const created = await branchMemberRepository.create({ orgId, branchId, userId, orgRole, isActive: !inactive });
    await organizationAuditService.record({
      actor, action: 'member.branch.assign', orgId, targetUserId: userId,
      metadata: { branchId, orgRole },
    });
    return created;
  },

  async unassignFromBranch(orgId: string, userId: string, branchId: string, actor: RequestActor) {
    const target = await findMemberInOrg(userId, orgId);
    assertNotPlatformAdmin(target);
    assertNotRemoved(target);
    // A suspended member with no membership rows left would read as "unassigned", not
    // suspended, and could sign in again. Reactivate first, then change branches.
    if (await isCurrentlySuspended(userId)) {
      throw new AppError('Reactivate this member before changing their branches', 409);
    }
    const branch = await branchRepository.findById(branchId, orgId);
    if (!branch) throw new AppError('Branch not found', 404);

    await branchMemberRepository.removeFromBranch(branchId, userId);
    await organizationAuditService.record({
      actor, action: 'member.branch.unassign', orgId, targetUserId: userId, metadata: { branchId },
    });
  },

  /** Name and phone of another member. Email, role and access are never touched here. */
  async updateProfile(orgId: string, userId: string, patch: MemberProfilePatch, actor: RequestActor) {
    const target = await findMemberInOrg(userId, orgId);
    if (target.role === 'platform_admin') {
      throw new AppError('Platform admin profiles cannot be edited here', 403);
    }
    assertNotRemoved(target);

    const firstName = patch.firstName?.trim() ?? target.firstName;
    const lastName = patch.lastName?.trim() ?? target.lastName;
    if (!firstName || !lastName) throw new AppError('Name cannot be empty', 400);
    const update: { firstName: string; lastName: string; name: string; phoneNumber?: string } = {
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim() || target.name,
    };
    if (patch.phoneNumber !== undefined) update.phoneNumber = patch.phoneNumber.trim();

    const updated = await userRepository.update(userId, update);
    if (!updated) throw new AppError('Member not found in this organisation', 404);

    await organizationAuditService.record({
      actor, action: 'member.profile.update', orgId, targetUserId: userId,
      metadata: { fields: Object.keys(patch) },
    });
    return {
      userId,
      firstName: updated.firstName,
      lastName: updated.lastName,
      phoneNumber: updated.phoneNumber,
      name: updated.name,
    };
  },
};
