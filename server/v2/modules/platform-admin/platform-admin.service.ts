import { AppError } from '../../utils/error-handler';
import { platformAdminRepository, type ListUsersFilters } from './platform-admin.repository';
import {
  platformAdminAuditRepository,
  type AuditFilters,
} from './platform-admin-audit.repository';

export interface AdminActor {
  userId:    string;
  ipAddress: string | null;
  userAgent: string | null;
}

const VALID_ORG_ROLES = ['org_admin', 'branch_manager', 'agent', 'homeworker', 'referral_agent'] as const;
export type AssignableOrgRole = (typeof VALID_ORG_ROLES)[number];

async function recordAudit(params: {
  actor:         AdminActor;
  action:        string;
  targetOrgId?:  string;
  targetUserId?: string;
  metadata?:     Record<string, unknown>;
}): Promise<void> {
  try {
    await platformAdminAuditRepository.create({
      actorUserId:  params.actor.userId,
      action:       params.action,
      targetOrgId:  params.targetOrgId  ?? null,
      targetUserId: params.targetUserId ?? null,
      metadata:     params.metadata     ?? {},
      ipAddress:    params.actor.ipAddress,
      userAgent:    params.actor.userAgent,
    });
  } catch (err) {
    // Mutation already succeeded — log and move on rather than rolling back
    // the user-visible action over an audit-write failure.
    console.error('[platform-admin] audit write failed:', err);
  }
}

export const platformAdminService = {
  async listOrganizations() {
    return platformAdminRepository.findAllOrgsWithCounts();
  },

  async getOrganization(id: string) {
    const org = await platformAdminRepository.findOrgByIdWithCounts(id);
    if (!org) throw new AppError('Organization not found', 404);
    return org;
  },

  async suspend(id: string, actor: AdminActor, reason: string) {
    const org = await platformAdminRepository.findOrgByIdWithCounts(id);
    if (!org) throw new AppError('Organization not found', 404);
    await platformAdminRepository.setActive(id, false);
    await recordAudit({
      actor,
      action: 'org.suspend',
      targetOrgId: id,
      metadata: { reason, previousIsActive: org.isActive },
    });
  },

  async activate(id: string, actor: AdminActor) {
    const org = await platformAdminRepository.findOrgByIdWithCounts(id);
    if (!org) throw new AppError('Organization not found', 404);
    await platformAdminRepository.setActive(id, true);
    await recordAudit({
      actor,
      action: 'org.activate',
      targetOrgId: id,
      metadata: { previousIsActive: org.isActive },
    });
  },

  async changePlan(id: string, plan: string, seatLimit: number | undefined, actor: AdminActor) {
    const org = await platformAdminRepository.findOrgByIdWithCounts(id);
    if (!org) throw new AppError('Organization not found', 404);
    await platformAdminRepository.updatePlan(id, plan, seatLimit);
    await recordAudit({
      actor,
      action: 'org.plan.change',
      targetOrgId: id,
      metadata: {
        from: { plan: org.plan, seatLimit: org.seatLimit },
        to:   { plan, seatLimit: seatLimit ?? org.seatLimit },
      },
    });
  },

  async listUsersAcrossOrgs(filters: ListUsersFilters) {
    return platformAdminRepository.findAllUsersAcrossOrgs(filters);
  },

  async getUserAcrossOrgs(id: string) {
    const u = await platformAdminRepository.findUserByIdAcrossOrgs(id);
    if (!u) throw new AppError('User not found', 404);
    return u;
  },

  async listUsersByOrg(orgId: string) {
    const org = await platformAdminRepository.findOrgByIdWithCounts(orgId);
    if (!org) throw new AppError('Organization not found', 404);
    return platformAdminRepository.findUsersByOrg(orgId);
  },

  async changeUserOrgRole(orgId: string, userId: string, newRole: AssignableOrgRole, actor: AdminActor) {
    if (!VALID_ORG_ROLES.includes(newRole)) throw new AppError('Invalid org role', 400);

    const u = await platformAdminRepository.findUserByIdAcrossOrgs(userId);
    if (!u) throw new AppError('User not found', 404);
    if (u.orgId !== orgId) throw new AppError('User does not belong to this organization', 404);

    await platformAdminRepository.setUserOrgRole(userId, orgId, newRole);
    await recordAudit({
      actor,
      action: 'user.role.change',
      targetOrgId: orgId,
      targetUserId: userId,
      metadata: { from: u.orgRole, to: newRole },
    });
  },

  async deactivateUser(orgId: string, userId: string, actor: AdminActor, reason?: string) {
    const u = await platformAdminRepository.findUserByIdAcrossOrgs(userId);
    if (!u) throw new AppError('User not found', 404);
    if (u.orgId !== orgId) throw new AppError('User does not belong to this organization', 404);

    await platformAdminRepository.setUserBanned(userId, orgId, true, reason);
    await recordAudit({
      actor,
      action: 'user.deactivate',
      targetOrgId: orgId,
      targetUserId: userId,
      metadata: { reason: reason ?? null },
    });
  },

  async reactivateUser(orgId: string, userId: string, actor: AdminActor) {
    const u = await platformAdminRepository.findUserByIdAcrossOrgs(userId);
    if (!u) throw new AppError('User not found', 404);
    if (u.orgId !== orgId) throw new AppError('User does not belong to this organization', 404);

    await platformAdminRepository.setUserBanned(userId, orgId, false);
    await recordAudit({
      actor,
      action: 'user.reactivate',
      targetOrgId: orgId,
      targetUserId: userId,
      metadata: {},
    });
  },

  async listBranchesByOrg(orgId: string) {
    const org = await platformAdminRepository.findOrgByIdWithCounts(orgId);
    if (!org) throw new AppError('Organization not found', 404);
    return platformAdminRepository.findBranchesByOrg(orgId);
  },

  async startImpersonation(orgId: string, actor: AdminActor) {
    const org = await platformAdminRepository.findOrgByIdWithCounts(orgId);
    if (!org) throw new AppError('Organization not found', 404);
    await recordAudit({
      actor,
      action: 'org.impersonate.start',
      targetOrgId: orgId,
      metadata: { orgName: org.name },
    });
    return org;
  },

  async stopImpersonation(orgId: string | null, actor: AdminActor) {
    await recordAudit({
      actor,
      action: 'org.impersonate.stop',
      targetOrgId: orgId ?? undefined,
      metadata: {},
    });
  },

  async listAuditLog(filters: AuditFilters) {
    return platformAdminAuditRepository.findAll(filters);
  },
};
