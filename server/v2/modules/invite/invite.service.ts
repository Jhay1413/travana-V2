import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AppError } from '../../utils/error-handler';
import { getPublicBaseUrl } from '../../utils/public-url';
import { getEmailProvider } from '../../../services/email-provider';
import { inviteRepository, type PendingInviteRow } from './invite.repository';
import { branchRepository } from '../branch/branch.repository';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_ROLES = ['branch_manager', 'agent', 'homeworker', 'referral_agent'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];

// Branch managers can only invite "downstream" — agents and homeworkers.
const BRANCH_MANAGER_INVITABLE: ReadonlySet<AllowedRole> = new Set<AllowedRole>(['agent', 'homeworker']);

function buildInviteUrl(token: string): string {
  const base = getPublicBaseUrl() || 'http://localhost:5000';
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}

function buildInviteEmail(orgName: string, inviterName: string | null, url: string) {
  const subject = `You've been invited to join ${orgName} on TravelHub`;
  const text = `${inviterName ? `${inviterName} has` : 'You have been'} invited you to join ${orgName} on TravelHub.

Click the link below to set up your account:
${url}

This invitation expires in 7 days.`;
  const html = `
    <p>${inviterName ? `<strong>${inviterName}</strong> has` : 'You have been'} invited you to join <strong>${orgName}</strong> on TravelHub.</p>
    <p>Click the button below to set up your account:</p>
    <p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Accept invitation</a></p>
    <p style="color:#888;font-size:12px">This invitation expires in 7 days.</p>
  `;
  return { subject, text, html };
}

export interface SendInvitePayload {
  email:    string;
  branchId: string;
  orgRole:  AllowedRole;
}

export interface AcceptInvitePayload {
  token:       string;
  firstName:   string;
  lastName:    string;
  phoneNumber: string;
  password:    string;
}

export interface ActorContext {
  orgId:       string;
  userId:      string | null;
  orgRole:     string;
  branchId:    string | null;
}

function isBranchManager(actor: ActorContext): boolean {
  return actor.orgRole === 'branch_manager';
}

function assertManagerCanInvite(actor: ActorContext, payload: SendInvitePayload) {
  if (!isBranchManager(actor)) return;
  if (!actor.branchId) {
    throw new AppError('You must belong to a branch to invite teammates', 403);
  }
  if (payload.branchId !== actor.branchId) {
    throw new AppError('You can only invite to your own branch', 403);
  }
  if (!BRANCH_MANAGER_INVITABLE.has(payload.orgRole)) {
    throw new AppError('Branch managers can only invite agents or homeworkers', 403);
  }
}

function assertManagerCanActOnInvite(actor: ActorContext, invite: PendingInviteRow | { branchId?: string | null }) {
  if (!isBranchManager(actor)) return;
  if (!actor.branchId) {
    throw new AppError('You must belong to a branch to manage invites', 403);
  }
  if (!invite.branchId || invite.branchId !== actor.branchId) {
    throw new AppError('You can only manage invites for your own branch', 403);
  }
}

export const inviteService = {
  async send(payload: SendInvitePayload, actor: ActorContext) {
    const email = payload.email.toLowerCase().trim();
    if (!email) throw new AppError('Email is required', 400);
    if (!ALLOWED_ROLES.includes(payload.orgRole)) {
      throw new AppError('Invalid role', 400);
    }

    assertManagerCanInvite(actor, payload);

    const branch = await branchRepository.findById(payload.branchId, actor.orgId);
    if (!branch) throw new AppError('Branch not found', 404);

    const existing = await inviteRepository.findByEmail(email);
    if (existing) {
      if (!existing.inviteToken) {
        throw new AppError('A user with this email already exists', 409);
      }
      if (existing.orgId !== actor.orgId) {
        throw new AppError('This email is already invited to another organisation', 409);
      }
      // Re-issue token for an existing pending invite (acts like resend)
      return this.resend(existing.id, actor);
    }

    const orgName = await inviteRepository.getOrgName(actor.orgId);
    if (!orgName) throw new AppError('Organisation not found', 404);

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + INVITE_TTL_MS);
    const userId = crypto.randomUUID();

    const created = await inviteRepository.createPendingUserWithBranchMembership(
      {
        id: userId,
        name: email,
        email,
        emailVerified: false,
        firstName: '',
        lastName: '',
        phoneNumber: '',
        role: 'Agent',
        orgId: actor.orgId,
        orgRole: payload.orgRole,
        inviteToken: token,
        inviteTokenExpiry: expiry,
        invitedBy: actor.userId,
        invitedAt: new Date(),
        inviteAgencyName: orgName,
      } as any,
      {
        orgId: actor.orgId,
        branchId: payload.branchId,
        userId,
        orgRole: payload.orgRole,
        isActive: false,
      },
    );

    await this.sendInviteEmail(email, orgName, token);

    return { userId: created.id, email, branchId: payload.branchId, expiresAt: expiry };
  },

  async resend(userId: string, actor: ActorContext) {
    const found = await inviteRepository.findById(userId);
    if (!found || found.orgId !== actor.orgId || !found.inviteToken) {
      throw new AppError('Invite not found', 404);
    }

    if (isBranchManager(actor)) {
      const member = await inviteRepository.findBranchMembershipForUser(actor.orgId, userId);
      assertManagerCanActOnInvite(actor, { branchId: member?.branchId ?? null });
    }

    const orgName = await inviteRepository.getOrgName(actor.orgId);
    if (!orgName) throw new AppError('Organisation not found', 404);

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + INVITE_TTL_MS);

    await inviteRepository.updateUser(userId, {
      inviteToken: token,
      inviteTokenExpiry: expiry,
      invitedAt: new Date(),
    });

    await this.sendInviteEmail(found.email, orgName, token);

    return { userId, email: found.email, expiresAt: expiry };
  },

  async getByToken(token: string) {
    const found = await inviteRepository.findByToken(token);
    if (!found || !found.inviteToken) throw new AppError('Invalid or expired invitation', 400);
    if (!found.inviteTokenExpiry || new Date(found.inviteTokenExpiry) < new Date()) {
      throw new AppError('This invitation has expired', 400);
    }
    return {
      email: found.email,
      orgRole: found.orgRole,
      orgName: found.inviteAgencyName,
      expiresAt: found.inviteTokenExpiry,
    };
  },

  async acceptInvite(payload: AcceptInvitePayload) {
    if (!payload.token) throw new AppError('Token is required', 400);
    if (!payload.firstName?.trim()) throw new AppError('First name is required', 400);
    if (!payload.lastName?.trim()) throw new AppError('Last name is required', 400);
    if (!payload.phoneNumber?.trim()) throw new AppError('Phone number is required', 400);
    if (!payload.password || payload.password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }

    const found = await inviteRepository.findByToken(payload.token);
    if (!found || !found.inviteToken) throw new AppError('Invalid or expired invitation', 400);
    if (!found.inviteTokenExpiry || new Date(found.inviteTokenExpiry) < new Date()) {
      throw new AppError('This invitation has expired', 400);
    }
    if (!found.orgId) throw new AppError('Invitation is missing organisation context', 400);

    const hashedPassword = await bcrypt.hash(payload.password, 10);
    const fullName = `${payload.firstName.trim()} ${payload.lastName.trim()}`.trim();

    await inviteRepository.finaliseAcceptedInvite(found.id, found.orgId!, {
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phoneNumber: payload.phoneNumber.trim(),
      name: fullName,
      password: hashedPassword,
      emailVerified: true,
      inviteToken: null,
      inviteTokenExpiry: null,
      invitedAt: null,
      updatedAt: new Date(),
    });

    return { userId: found.id, email: found.email };
  },

  async listByOrg(actor: ActorContext) {
    const all = await inviteRepository.findPendingByOrg(actor.orgId);
    if (!isBranchManager(actor)) return all;
    if (!actor.branchId) return [];
    return all.filter((inv) => inv.branchId === actor.branchId);
  },

  async revoke(userId: string, actor: ActorContext) {
    const found = await inviteRepository.findById(userId);
    if (!found || found.orgId !== actor.orgId) throw new AppError('Invite not found', 404);
    if (!found.inviteToken) throw new AppError('This member has already accepted — suspend them instead', 400);

    if (isBranchManager(actor)) {
      const member = await inviteRepository.findBranchMembershipForUser(actor.orgId, userId);
      assertManagerCanActOnInvite(actor, { branchId: member?.branchId ?? null });
    }

    await inviteRepository.deletePendingUser(userId, actor.orgId);
  },

  async sendInviteEmail(email: string, orgName: string, token: string) {
    try {
      const url = buildInviteUrl(token);
      const { subject, html, text } = buildInviteEmail(orgName, null, url);
      const provider = getEmailProvider();
      await provider.send({ to: email, subject, html, text });
    } catch (err) {
      console.error('[invite] email failed (invite still recorded):', err);
    }
  },
};
