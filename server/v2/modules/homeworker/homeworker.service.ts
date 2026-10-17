import crypto from 'crypto';
import { AppError } from '../../utils/error-handler';
import { homeworkerRepository } from './homeworker.repository';
import { placeholderNameForEmail } from '../../utils/homeworker-name';
import { newInviteCredentials, sendInviteEmail } from '../invite/invite-email.service';
import { organizationSeatService } from '../organization/organization-seat.service';
import { organizationAuditService } from '../organization/organization-audit.service';
import { userAccessService } from '../user/user-access.service';
import type {
  HomeworkerActor,
  HomeworkerListItem,
  HomeworkerListRow,
  HomeworkerStatus,
  InviteHomeworkerInput,
  InviteHomeworkerResult,
  StatementLine,
  StatementPeriod,
  StatementResult,
  StatementResultPeriod,
  ProfitSharePercentInput,
  UpdateHomeworkerInput,
} from './homeworker.types';

const ADMIN_ROLES = ['org_admin', 'platform_admin'];

function assertAdmin(actor: HomeworkerActor): void {
  const roles = actor.orgRoles && actor.orgRoles.length > 0 ? actor.orgRoles : [actor.orgRole];
  if (!roles.some((r) => ADMIN_ROLES.includes(r))) {
    throw new AppError('Only organisation admins can manage homeworkers', 403);
  }
}

function toPercentString(value: ProfitSharePercentInput): string {
  return String(value);
}

/** Share fallback order: explicit value, then the org default, then null. */
function resolveShare(requested: ProfitSharePercentInput | undefined, orgDefault: number | null): string | null {
  if (requested !== undefined) return toPercentString(requested);
  if (orgDefault !== null && orgDefault !== undefined) return String(orgDefault);
  return null;
}

export function deriveHomeworkerStatus(row: Pick<HomeworkerListRow, 'isActive' | 'inviteToken' | 'memberIsActive'>): HomeworkerStatus {
  if (!row.isActive) return 'archived';
  if (row.inviteToken !== null) return 'pending';
  if (row.memberIsActive !== true) return 'suspended';
  return 'active';
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STATEMENT_RANGE_DAYS = 366;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseIsoDate(value: string, label: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(d.getTime()) || isoDate(d) !== value) {
    throw new AppError(`${label} must be a valid date (YYYY-MM-DD)`, 400);
  }
  return d;
}

/** Period [from, to): defaults to the current calendar month (UTC) when both are omitted. */
export function resolveStatementPeriod(from?: string, to?: string): StatementPeriod {
  if (from === undefined && to === undefined) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { from: isoDate(start), to: isoDate(end) };
  }
  if (from === undefined || to === undefined) {
    throw new AppError('Provide both from and to, or neither', 400);
  }
  const start = parseIsoDate(from, 'from');
  const end = parseIsoDate(to, 'to');
  if (start.getTime() >= end.getTime()) throw new AppError('from must be before to', 400);
  if ((end.getTime() - start.getTime()) / DAY_MS > MAX_STATEMENT_RANGE_DAYS) {
    throw new AppError('Statement period cannot exceed 1 year', 400);
  }
  return { from, to };
}

/** True when [from, to) is exactly one calendar month: from is the 1st and to the 1st of the next month. */
export function isCalendarMonth(period: StatementPeriod): boolean {
  if (!period.from.endsWith('-01')) return false;
  const start = new Date(`${period.from}T00:00:00.000Z`);
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return isoDate(nextMonth) === period.to;
}

function toResultPeriod(period: StatementPeriod): StatementResultPeriod {
  const lastDay = new Date(new Date(`${period.to}T00:00:00.000Z`).getTime() - DAY_MS);
  return { ...period, periodEndInclusive: isoDate(lastDay) };
}

export const homeworkerService = {
  /** The single creation path for a homeworker branch (invite, HR, platform admin). */
  async invite(input: InviteHomeworkerInput, actor: HomeworkerActor, requestOrigin?: string | null): Promise<InviteHomeworkerResult> {
    assertAdmin(actor);
    const email = input.email.toLowerCase().trim();
    if (!email) throw new AppError('Email is required', 400);

    const existing = await homeworkerRepository.findUserByEmail(email);
    if (existing) {
      if (!existing.inviteToken) throw new AppError('A user with this email already exists', 409);
      if (existing.orgId !== actor.orgId) {
        throw new AppError('This email is already invited to another organisation', 409);
      }
      throw new AppError('This email already has a pending invite; resend or revoke it first', 409);
    }

    const org = await homeworkerRepository.findOrgDefaults(actor.orgId);
    if (!org) throw new AppError('Organisation not found', 404);

    // Every invite path takes a seat: active members plus pending invites must stay under the plan.
    await organizationSeatService.assertSeatAvailable(actor.orgId);

    const profitSharePercent = resolveShare(input.profitSharePercent, org.homeworkerCommission);
    const { token, expiry } = newInviteCredentials();
    const userId = crypto.randomUUID();
    const firstName = input.firstName?.trim() ?? '';
    const lastName = input.lastName?.trim() ?? '';
    const fullName = `${firstName} ${lastName}`.trim();

    const created = await homeworkerRepository.createHomeworkerAtomic({
      userValues: {
        id: userId,
        name: fullName || email,
        email,
        emailVerified: false,
        firstName,
        lastName,
        phoneNumber: '',
        role: 'Agent',
        orgId: actor.orgId,
        orgRole: 'homeworker',
        inviteToken: token,
        inviteTokenExpiry: expiry,
        invitedBy: actor.userId,
        invitedAt: new Date(),
        inviteAgencyName: org.name,
      },
      branchValues: {
        organizationId: actor.orgId,
        name: input.displayName?.trim() || placeholderNameForEmail(email),
        address: '',
        phone: '',
        email: '',
        openingPattern: 'mon-fri',
        bankHolidaysOpen: false,
        openingHours: [],
        isDefault: false,
        isActive: true,
        branchType: 'homeworker',
        profitSharePercent,
      },
    });

    await sendInviteEmail(email, org.name, token, requestOrigin);
    if (actor.requestActor) {
      await organizationAuditService.record({
        actor: actor.requestActor,
        action: 'invite.send',
        orgId: actor.orgId,
        targetUserId: created.user.id,
        metadata: { email, orgRole: 'homeworker', branchId: created.branch.id },
      });
    }

    return { userId: created.user.id, branchId: created.branch.id, email, expiresAt: expiry };
  },

  async list(orgId: string, includeArchived: boolean): Promise<HomeworkerListItem[]> {
    const rows = await homeworkerRepository.listByOrg(orgId, includeArchived);
    return rows.map((r) => ({
      branchId: r.branchId,
      name: r.name,
      status: deriveHomeworkerStatus(r),
      profitSharePercent: r.profitSharePercent,
      createdAt: r.createdAt,
      owner: { userId: r.ownerUserId, name: r.ownerName, email: r.ownerEmail },
    }));
  },

  async getMine(orgId: string, userId: string | null) {
    if (!userId) throw new AppError('Homeworker branch not found', 404);
    const branch = await homeworkerRepository.findByOwner(orgId, userId);
    if (!branch) throw new AppError('Homeworker branch not found', 404);
    return {
      branchId: branch.id,
      name: branch.name,
      profitSharePercent: branch.profitSharePercent,
      isActive: branch.isActive,
    };
  },

  async update(branchId: string, orgId: string, input: UpdateHomeworkerInput) {
    const branch = await homeworkerRepository.findHomeworkerBranch(branchId, orgId);
    if (!branch) throw new AppError('Homeworker not found', 404);

    const patch: { name?: string; profitSharePercent?: string } = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new AppError('Name cannot be empty', 400);
      patch.name = name;
    }
    if (input.profitSharePercent !== undefined) {
      patch.profitSharePercent = toPercentString(input.profitSharePercent);
    }
    if (Object.keys(patch).length === 0) throw new AppError('Nothing to update', 400);

    const updated = await homeworkerRepository.update(branchId, orgId, patch);
    if (!updated) throw new AppError('Homeworker not found', 404);
    return updated;
  },

  async archive(branchId: string, orgId: string) {
    const branch = await homeworkerRepository.findHomeworkerBranch(branchId, orgId);
    if (!branch) throw new AppError('Homeworker not found', 404);
    if (!branch.isActive) throw new AppError('Homeworker is already archived', 409);
    // An unaccepted invite has no access to lose; it must be revoked (which removes the empty branch).
    if (branch.ownerUserId && (await homeworkerRepository.hasPendingInvite(branch.ownerUserId))) {
      throw new AppError('Revoke the invite instead', 400);
    }

    const archived = await homeworkerRepository.archiveAtomic(branchId, orgId);
    if (!archived) throw new AppError('Homeworker not found', 404);
    // Archiving closes their access; committed, so end any live session too.
    if (archived.ownerUserId) await userAccessService.revokeAccess(archived.ownerUserId);
    return archived;
  },

  async getStatement(actor: HomeworkerActor, branchId: string, from?: string, to?: string): Promise<StatementResult> {
    assertAdmin(actor);
    return this.buildStatement(actor.orgId, branchId, from, to);
  },

  /** The caller's own statement; 404 when they own no homeworker branch (legacy shared-branch homeworker). */
  async getMyStatement(actor: HomeworkerActor, from?: string, to?: string): Promise<StatementResult> {
    if (!actor.userId) throw new AppError('Homeworker branch not found', 404);
    const own = await homeworkerRepository.findByOwner(actor.orgId, actor.userId);
    if (!own) throw new AppError('Homeworker branch not found', 404);
    return this.buildStatement(actor.orgId, own.id, from, to);
  },

  async buildStatement(orgId: string, branchId: string, from?: string, to?: string): Promise<StatementResult> {
    const period = resolveStatementPeriod(from, to);
    const branch = await homeworkerRepository.findHomeworkerBranch(branchId, orgId);
    if (!branch) throw new AppError('Homeworker not found', 404);
    if (branch.profitSharePercent === null) throw new AppError('Profit share not set', 400);

    const [totals, bookingRows, upsellRows, finalised] = await Promise.all([
      homeworkerRepository.getStatementTotals(orgId, branchId, period.from, period.to, branch.profitSharePercent),
      homeworkerRepository.getStatementLines(orgId, branchId, period.from, period.to),
      homeworkerRepository.getStatementUpsellLines(orgId, branchId, period.from, period.to),
      homeworkerRepository.findStatement(branchId, period.from, period.to),
    ]);
    const lines: StatementLine[] = [
      ...bookingRows.map((r): StatementLine => ({ ...r, type: 'booking' })),
      ...upsellRows.map((r): StatementLine => ({ ...r, type: 'upsell' })),
    ];

    return {
      branch: { id: branch.id, name: branch.name, ownerUserId: branch.ownerUserId, profitSharePercent: branch.profitSharePercent },
      period: toResultPeriod(period),
      // A finalised period shows the frozen figures; live ones are exposed via liveGross.
      gross: finalised ? finalised.grossProfit : totals.gross,
      liveGross: totals.gross,
      driftWarning: finalised !== null && finalised.grossProfit !== totals.gross,
      sharePercent: finalised ? finalised.sharePercent : branch.profitSharePercent,
      homeworkerShare: finalised ? finalised.homeworkerShare : totals.homeworkerShare,
      orgShare: finalised ? finalised.orgShare : totals.orgShare,
      bookingCount: totals.bookingCount,
      lines,
      finalised,
    };
  },

  /** Freezes the computed statement for a period; one per (branch, period start). */
  async finaliseStatement(actor: HomeworkerActor, branchId: string, from: string, to: string) {
    assertAdmin(actor);
    const period = resolveStatementPeriod(from, to);
    // Finalising is per whole calendar month, so periods can never overlap or double pay.
    if (!isCalendarMonth(period)) throw new AppError('Statements are finalised per calendar month', 400);
    // Only a finished period can be frozen: `to` is exclusive, so `to <= today` (UTC) means it has ended.
    if (period.to > isoDate(new Date())) throw new AppError('Period has not ended', 400);
    const branch = await homeworkerRepository.findHomeworkerBranch(branchId, actor.orgId);
    if (!branch) throw new AppError('Homeworker not found', 404);
    if (branch.profitSharePercent === null) throw new AppError('Profit share not set', 400);

    // Overlap (not just equal start) is refused so no period can be paid twice.
    const overlapping = await homeworkerRepository.findOverlappingStatement(branchId, period.from, period.to);
    if (overlapping) throw new AppError('A statement already exists for an overlapping period', 409);

    const totals = await homeworkerRepository.getStatementTotals(
      actor.orgId, branchId, period.from, period.to, branch.profitSharePercent,
    );

    const stored = await homeworkerRepository.insertStatement({
      orgId: actor.orgId,
      branchId,
      userId: branch.ownerUserId,
      periodStart: period.from,
      periodEnd: period.to,
      periodEndInclusive: toResultPeriod(period).periodEndInclusive,
      grossProfit: totals.gross,
      sharePercent: branch.profitSharePercent,
      homeworkerShare: totals.homeworkerShare,
      orgShare: totals.orgShare,
      finalisedBy: actor.userId,
      auditName: null,
    });
    if (stored.status === 'duplicate') throw new AppError('A statement already exists for this period', 409);
    return stored.row;
  },

  /** Throws 400 when the user owns an archived homeworker branch (no unsuspending; re-invite instead). */
  async assertNotArchived(orgId: string, userId: string): Promise<void> {
    const branch = await homeworkerRepository.findByOwner(orgId, userId);
    if (branch && !branch.isActive) {
      throw new AppError('Homeworker is archived; re-invite instead', 400);
    }
  },

  /** A per-user homeworker branch holds exactly one member; throws 400 if one is already there. */
  async assertCanAddMember(branchId: string, orgId: string): Promise<void> {
    const branch = await homeworkerRepository.findHomeworkerBranch(branchId, orgId);
    if (!branch) return;
    const members = await homeworkerRepository.countMembers(branchId);
    if (members >= 1) {
      throw new AppError('A homeworker branch can only have one member', 400);
    }
  },
};
