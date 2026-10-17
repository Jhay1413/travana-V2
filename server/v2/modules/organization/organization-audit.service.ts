import type { RequestActor } from '../../utils/request-actor';
import { platformAdminAuditRepository } from '../platform-admin/platform-admin-audit.repository';

export type OrgAuditAction =
  | 'member.role.change'
  | 'member.suspend'
  | 'member.reactivate'
  | 'member.remove'
  | 'member.branch.assign'
  | 'member.branch.unassign'
  | 'member.profile.update'
  | 'invite.send'
  | 'invite.resend'
  | 'invite.revoke'
  | 'targets.business.set'
  | 'targets.shop.set'
  | 'targets.agent.set'
  | 'targets.homeworker.self'
  | 'targets.homeworker.override'
  | 'targets.homeworker.revert';

export interface OrgAuditEntry {
  actor:         RequestActor;
  action:        OrgAuditAction;
  orgId:         string;
  targetUserId?: string | null;
  metadata?:     Record<string, unknown>;
}

export const organizationAuditService = {
  /**
   * Writes an admin_audit_log row. The change it describes is already committed,
   * so a failed audit write is logged and swallowed rather than undoing the action.
   */
  async record(entry: OrgAuditEntry): Promise<void> {
    try {
      await platformAdminAuditRepository.create({
        actorUserId:  entry.actor.userId,
        action:       entry.action,
        targetOrgId:  entry.orgId || null,
        targetUserId: entry.targetUserId ?? null,
        metadata:     { ...(entry.metadata ?? {}), ...(entry.actor.impersonating ? { impersonating: true } : {}) },
        ipAddress:    entry.actor.ipAddress,
        userAgent:    entry.actor.userAgent,
      });
    } catch (err) {
      console.error('[organization-audit] audit write failed:', err);
    }
  },
};
