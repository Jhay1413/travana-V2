import { db } from '../../config/database';
import {
  auditLog,
  booking,
  booking_upsell,
  branchMembers,
  branches,
  clientTable,
  homeworkerPayoutStatement,
  transaction,
  hrRecordsTable,
  organization,
  user,
  userOrgRoles,
  type Branch,
} from '@shared/schema';
import { and, asc, count, desc, eq, gt, isNotNull, lt, sql } from 'drizzle-orm';
import {
  bookingCommissionNumeric,
  bookingNetExpr,
  bookingsCountSubquery,
  derivedGross,
  grossDerivedTable,
  homeworkerShareFromGross,
  orgShareFromGross,
  statementBookingConds,
  statementUpsellConds,
  toWindow,
  upsellAmountExpr,
} from './homeworker-statement.sql';
import { branchMemberRepository } from '../branch-member/branch-member.repository';
import type {
  CreateHomeworkerRecords,
  CreatedHomeworker,
  FinaliseStatementRecord,
  InsertStatementResult,
  HomeworkerListRow,
  StatementBookingRow,
  StatementTotals,
  StatementUpsellRow,
  OrgHomeworkerDefaults,
} from './homeworker.types';

export const homeworkerRepository = {
  async findOrgDefaults(orgId: string): Promise<OrgHomeworkerDefaults | null> {
    const [row] = await db
      .select({ name: organization.name, homeworkerCommission: organization.homeworkerCommission })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    return row ?? null;
  },

  async findUserByEmail(email: string) {
    const [row] = await db
      .select({ id: user.id, orgId: user.orgId, inviteToken: user.inviteToken })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    return row ?? null;
  },

  /**
   * Atomic: pending user, homeworker branch (owned by that user), inactive
   * branch membership, user_org_roles row and hr_records row. Mirrors
   * inviteRepository.createPendingUserWithBranchMembership.
   */
  async createHomeworkerAtomic(records: CreateHomeworkerRecords): Promise<CreatedHomeworker> {
    return db.transaction(async (tx) => {
      const [newUser] = await tx.insert(user).values(records.userValues).returning();
      const [branch] = await tx
        .insert(branches)
        .values({ ...records.branchValues, ownerUserId: newUser.id })
        .returning();

      await tx.insert(branchMembers).values({
        orgId: branch.organizationId,
        branchId: branch.id,
        userId: newUser.id,
        orgRole: 'homeworker',
        isActive: false,
      });

      await tx
        .insert(userOrgRoles)
        .values({ userId: newUser.id, orgId: branch.organizationId, role: 'homeworker' })
        .onConflictDoNothing({ target: [userOrgRoles.userId, userOrgRoles.orgId, userOrgRoles.role] });

      await tx
        .insert(hrRecordsTable)
        .values({ orgId: branch.organizationId, userId: newUser.id })
        .onConflictDoNothing({ target: hrRecordsTable.userId });

      return { user: newUser, branch };
    });
  },

  async listByOrg(orgId: string, includeArchived: boolean): Promise<HomeworkerListRow[]> {
    const conditions = [eq(branches.organizationId, orgId), eq(branches.branchType, 'homeworker')];
    if (!includeArchived) conditions.push(eq(branches.isActive, true));
    return db
      .select({
        branchId:           branches.id,
        name:               branches.name,
        isActive:           branches.isActive,
        profitSharePercent: branches.profitSharePercent,
        createdAt:          branches.createdAt,
        ownerUserId:        user.id,
        ownerName:          user.name,
        ownerEmail:         user.email,
        inviteToken:        user.inviteToken,
        memberIsActive:     branchMembers.isActive,
      })
      .from(branches)
      .innerJoin(user, eq(user.id, branches.ownerUserId))
      .leftJoin(branchMembers, and(eq(branchMembers.branchId, branches.id), eq(branchMembers.userId, user.id)))
      .where(and(...conditions))
      .orderBy(asc(branches.name));
  },

  /** A per-user homeworker branch (owner set) of this org; the legacy shared branch has no owner. */
  async findHomeworkerBranch(branchId: string, orgId: string): Promise<Branch | null> {
    const [row] = await db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.id, branchId),
          eq(branches.organizationId, orgId),
          eq(branches.branchType, 'homeworker'),
          isNotNull(branches.ownerUserId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async findByOwner(orgId: string, userId: string): Promise<Branch | null> {
    const [row] = await db
      .select()
      .from(branches)
      .where(
        and(
          eq(branches.organizationId, orgId),
          eq(branches.branchType, 'homeworker'),
          eq(branches.ownerUserId, userId),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  async update(
    branchId: string,
    orgId: string,
    patch: { name?: string; profitSharePercent?: string },
  ): Promise<Branch | null> {
    const [row] = await db
      .update(branches)
      .set(patch)
      .where(and(eq(branches.id, branchId), eq(branches.organizationId, orgId), eq(branches.branchType, 'homeworker')))
      .returning();
    return row ?? null;
  },

  /**
   * Atomic: deactivate the branch and suspend its owner. Suspension uses the
   * same mechanism as organization-member suspension (branch_members.is_active
   * = false), so access is lost. Nothing is deleted.
   */
  async archiveAtomic(branchId: string, orgId: string): Promise<Branch | null> {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .update(branches)
        .set({ isActive: false })
        .where(and(eq(branches.id, branchId), eq(branches.organizationId, orgId)))
        .returning();
      if (!row) return null;
      if (row.ownerUserId) {
        await branchMemberRepository.setActiveForUser(orgId, row.ownerUserId, false, tx);
      }
      return row;
    });
  },

  /** True while the user has not accepted their invite (invite token still set). */
  async hasPendingInvite(userId: string): Promise<boolean> {
    const [row] = await db
      .select({ inviteToken: user.inviteToken })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.inviteToken != null;
  },

  /**
   * Period totals for a homeworker branch, computed entirely in SQL numeric:
   * gross = ROUND(GREATEST(a + b, 0), 2) where (a) is the net of bookings created
   * in [from, to) and (b) is the commission of active upsells whose added_at is in
   * [from, to) on ANY booking of the branch; share = ROUND(gross * pct / 100, 2);
   * org share = gross - share.
   */
  async getStatementTotals(
    orgId: string,
    branchId: string,
    from: string,
    to: string,
    sharePercent: string,
  ): Promise<StatementTotals> {
    const w = toWindow(from, to);
    const [row] = await db
      .select({
        gross: sql<string>`CAST(${derivedGross} AS TEXT)`,
        homeworkerShare: sql<string>`CAST(${homeworkerShareFromGross(sharePercent)} AS TEXT)`,
        orgShare: sql<string>`CAST(${orgShareFromGross(sharePercent)} AS TEXT)`,
        bookingCount: sql<number>`${bookingsCountSubquery(orgId, branchId, w)}`,
      })
      // The gross is computed once in a derived single-row table; shares are derived from it.
      .from(grossDerivedTable(orgId, branchId, w));
    return row ?? { gross: '0.00', homeworkerShare: '0.00', orgShare: '0.00', bookingCount: 0 };
  },

  /** One row per booking created in the window, oldest first. Money columns are exact numeric strings. */
  async getStatementLines(orgId: string, branchId: string, from: string, to: string): Promise<StatementBookingRow[]> {
    const w = toWindow(from, to);
    return db
      .select({
        bookingId: booking.id,
        transactionId: transaction.id,
        clientName: sql<string | null>`NULLIF(TRIM(CONCAT_WS(' ', ${clientTable.firstName}, ${clientTable.surename})), '')`,
        dateCreated: booking.date_created,
        commission: sql<string>`CAST(ROUND(${bookingCommissionNumeric()}, 2) AS TEXT)`,
        discounts: sql<string>`CAST(ROUND(COALESCE(CAST(${booking.discounts} AS NUMERIC), 0), 2) AS TEXT)`,
        serviceCharge: sql<string>`CAST(ROUND(COALESCE(CAST(${booking.service_charge} AS NUMERIC), 0), 2) AS TEXT)`,
        net: sql<string>`CAST(ROUND(${bookingNetExpr()}, 2) AS TEXT)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(statementBookingConds(orgId, branchId, w))
      .orderBy(asc(booking.date_created), asc(booking.id));
  },

  /** One row per active upsell added in the window on any booking of the branch, oldest first. */
  async getStatementUpsellLines(orgId: string, branchId: string, from: string, to: string): Promise<StatementUpsellRow[]> {
    const w = toWindow(from, to);
    return db
      .select({
        bookingId: booking.id,
        transactionId: transaction.id,
        clientName: sql<string | null>`NULLIF(TRIM(CONCAT_WS(' ', ${clientTable.firstName}, ${clientTable.surename})), '')`,
        addedAt: booking_upsell.added_at,
        upsellType: booking_upsell.upsell_type,
        amount: sql<string>`CAST(ROUND(${upsellAmountExpr()}, 2) AS TEXT)`,
      })
      .from(booking_upsell)
      .innerJoin(booking, eq(booking_upsell.booking_id, booking.id))
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(statementUpsellConds(orgId, branchId, w))
      .orderBy(asc(booking_upsell.added_at), asc(booking_upsell.id));
  },

  /** The statement for EXACTLY this period (start and exclusive end both match). */
  async findStatement(branchId: string, periodStart: string, periodEnd: string) {
    const [row] = await db
      .select()
      .from(homeworkerPayoutStatement)
      .where(
        and(
          eq(homeworkerPayoutStatement.branchId, branchId),
          eq(homeworkerPayoutStatement.periodStart, periodStart),
          eq(homeworkerPayoutStatement.periodEnd, periodEnd),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /** Stored statements (draft and final) of one homeworker branch in the org, newest period first. */
  async listStatementsByBranch(orgId: string, branchId: string, limit = 24) {
    return db
      .select()
      .from(homeworkerPayoutStatement)
      .where(and(eq(homeworkerPayoutStatement.orgId, orgId), eq(homeworkerPayoutStatement.branchId, branchId)))
      .orderBy(desc(homeworkerPayoutStatement.periodStart))
      .limit(limit);
  },

  /** Any stored statement whose [start, end) overlaps [from, to): start < to AND end > from. */
  async findOverlappingStatement(branchId: string, from: string, to: string) {
    const [row] = await db
      .select()
      .from(homeworkerPayoutStatement)
      .where(
        and(
          eq(homeworkerPayoutStatement.branchId, branchId),
          lt(homeworkerPayoutStatement.periodStart, to),
          gt(homeworkerPayoutStatement.periodEnd, from),
        ),
      )
      .limit(1);
    return row ?? null;
  },

  /**
   * Atomic: store the final statement and its audit row together. A concurrent
   * finalise for the same (branch, period start) hits the unique constraint
   * (23505, possibly nested in err.cause); that is reported as `duplicate` and
   * the service turns it into the 409.
   */
  async insertStatement(record: FinaliseStatementRecord): Promise<InsertStatementResult> {
    try {
      const row = await db.transaction(async (tx) => {
        const now = new Date();
        const [row] = await tx
          .insert(homeworkerPayoutStatement)
          .values({
            orgId: record.orgId,
            branchId: record.branchId,
            userId: record.userId,
            periodStart: record.periodStart,
            periodEnd: record.periodEnd,
            grossProfit: record.grossProfit,
            sharePercent: record.sharePercent,
            homeworkerShare: record.homeworkerShare,
            orgShare: record.orgShare,
            status: 'final',
            finalisedBy: record.finalisedBy,
            finalisedAt: now,
            updatedAt: now,
          })
          .returning();
        await tx.insert(auditLog).values({
          action: 'homeworker.statement.finalise',
          entityType: 'homeworker_payout_statement',
          entityId: row.id,
          entityTitle: `${record.periodStart} to ${record.periodEndInclusive}`,
          entityData: {
            branchId: record.branchId,
            userId: record.userId,
            periodStart: record.periodStart,
            periodEnd: record.periodEnd,
            periodEndInclusive: record.periodEndInclusive,
            periodEndNote: 'exclusive end stored',
            grossProfit: record.grossProfit,
            sharePercent: record.sharePercent,
            homeworkerShare: record.homeworkerShare,
            orgShare: record.orgShare,
          },
          performedBy: record.finalisedBy ?? 'system',
          performedByName: record.auditName,
        });
        return row;
      });
      return { status: 'created', row };
    } catch (err) {
      const e = err as { code?: string; cause?: { code?: string } };
      if ((e.code ?? e.cause?.code) === '23505') return { status: 'duplicate' };
      throw err;
    }
  },

  async countMembers(branchId: string): Promise<number> {
    const [row] = await db
      .select({ total: count() })
      .from(branchMembers)
      .where(eq(branchMembers.branchId, branchId));
    return Number(row?.total ?? 0);
  },
};
