import { db } from "../../config/database";
import {
  shopTargetTable,
  agentTargetTable,
  orgTargetTable,
  user,
  branchMembers,
  branches,
  booking,
  booking_upsell,
  transaction,
} from "@shared/schema";
import { eq, and, inArray, sql, gte, gt, type AnyColumn } from "drizzle-orm";
import type {
  ShopTargetInput,
  AgentTargetInput,
  AgentInfo,
  BranchRecord,
  MemberRecord,
  MonthAmountRow,
  BranchMonthAmountRow,
  AgentTargetRowData,
  AgentTargetRowWrite,
  ActualRow,
  ActualsFilter,
} from "./targets.types";
import { totalBookingCommissionExpr } from "../../utils/commission-sql";
import { ukStartOfYear, ukStartOfNextYear } from "../../utils/london-dates";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";

export async function getAllShopTargets(branchId: string) {
  return await db
    .select()
    .from(shopTargetTable)
    .where(eq(shopTargetTable.branchId, branchId))
    .orderBy(shopTargetTable.year, shopTargetTable.month);
}

export async function getShopTargetsByDateRange(branchId: string, startYear: number, startMonth: number, endYear: number, endMonth: number) {
  return await db
    .select()
    .from(shopTargetTable)
    .where(
      and(
        eq(shopTargetTable.branchId, branchId),
        sql`(${shopTargetTable.year} > ${startYear} OR (${shopTargetTable.year} = ${startYear} AND ${shopTargetTable.month} >= ${startMonth}))
            AND (${shopTargetTable.year} < ${endYear} OR (${shopTargetTable.year} = ${endYear} AND ${shopTargetTable.month} <= ${endMonth}))`,
      ),
    )
    .orderBy(shopTargetTable.year, shopTargetTable.month);
}

export async function bulkUpsertShopTargets(branchId: string, targets: ShopTargetInput[]) {
  if (targets.length === 0) return [];

  const rows = targets.map(t => ({
    branchId,
    year: t.year,
    month: t.month,
    targetAmount: t.targetAmount,
  }));

  return await db
    .insert(shopTargetTable)
    .values(rows)
    .onConflictDoUpdate({
      target: [shopTargetTable.branchId, shopTargetTable.year, shopTargetTable.month],
      set: {
        targetAmount: sql`excluded.target_amount`,
        updatedAt: new Date(),
      },
    })
    .returning();
}

export async function getAllAgentTargets(branchId: string) {
  return await db
    .select()
    .from(agentTargetTable)
    .where(eq(agentTargetTable.branchId, branchId))
    .orderBy(agentTargetTable.year, agentTargetTable.month);
}

export async function getAgentTargetsByDateRange(branchId: string, startYear: number, startMonth: number, endYear: number, endMonth: number) {
  return await db
    .select()
    .from(agentTargetTable)
    .where(
      and(
        eq(agentTargetTable.branchId, branchId),
        sql`(${agentTargetTable.year} > ${startYear} OR (${agentTargetTable.year} = ${startYear} AND ${agentTargetTable.month} >= ${startMonth}))
            AND (${agentTargetTable.year} < ${endYear} OR (${agentTargetTable.year} = ${endYear} AND ${agentTargetTable.month} <= ${endMonth}))`,
      ),
    )
    .orderBy(agentTargetTable.year, agentTargetTable.month);
}

export async function getAgentTargetsByUserId(branchId: string, userId: string) {
  return await db
    .select()
    .from(agentTargetTable)
    .where(and(eq(agentTargetTable.branchId, branchId), eq(agentTargetTable.userId, userId)))
    .orderBy(agentTargetTable.year, agentTargetTable.month);
}

export async function userBelongsToBranch(userId: string, branchId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: branchMembers.id })
    .from(branchMembers)
    .where(and(
      eq(branchMembers.userId, userId),
      eq(branchMembers.branchId, branchId),
      eq(branchMembers.isActive, true),
    ))
    .limit(1);
  return !!row;
}

export async function branchBelongsToOrg(branchId: string, orgId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: branches.id })
    .from(branches)
    .where(and(eq(branches.id, branchId), eq(branches.organizationId, orgId)))
    .limit(1);
  return !!row;
}

export async function getBranchInfo(
  branchId: string,
): Promise<{ branchType: "shop" | "homeworker"; ownerUserId: string | null } | null> {
  const [row] = await db
    .select({ branchType: branches.branchType, ownerUserId: branches.ownerUserId })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1);
  if (!row) return null;
  return {
    branchType: row.branchType === "homeworker" ? "homeworker" : "shop",
    ownerUserId: row.ownerUserId ?? null,
  };
}

export async function bulkUpsertAgentTargets(branchId: string, targets: AgentTargetInput[]) {
  if (targets.length === 0) return [];

  const rows = targets.map(t => ({
    branchId,
    userId: t.userId,
    year: t.year,
    month: t.month,
    targetAmount: t.targetAmount,
  }));

  return await db
    .insert(agentTargetTable)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        agentTargetTable.branchId,
        agentTargetTable.userId,
        agentTargetTable.year,
        agentTargetTable.month,
      ],
      set: {
        targetAmount: sql`excluded.target_amount`,
        updatedAt: new Date(),
      },
    })
    .returning();
}

export async function getActiveBranchMemberIds(branchId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db
    .select({ userId: branchMembers.userId })
    .from(branchMembers)
    .where(and(
      eq(branchMembers.branchId, branchId),
      eq(branchMembers.isActive, true),
      inArray(branchMembers.userId, userIds),
    ));
  return new Set(rows.map(r => r.userId));
}

export async function getAllAgents(branchId: string): Promise<AgentInfo[]> {
  const agents = await db
    .select({
      id: user.id,
      name: sql<string>`${user.firstName} || ' ' || ${user.lastName}`,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .innerJoin(branchMembers, eq(branchMembers.userId, user.id))
    .where(and(eq(branchMembers.branchId, branchId), eq(branchMembers.isActive, true)));

  // Exclude pure social media managers — they don't carry sales targets.
  const socialOnly = new Set(await userOrgRolesRepository.findSocialOnlyUserIds({ branchId }));
  return agents.filter((a) => !socialOnly.has(a.id));
}

export async function getTargetSummaryByDateRange(branchId: string, startYear: number, startMonth: number, endYear: number, endMonth: number, includeShopTargets = true) {
  const shopTargets = includeShopTargets
    ? await getShopTargetsByDateRange(branchId, startYear, startMonth, endYear, endMonth)
    : [];

  const agentTargetSums = await db
    .select({
      year: agentTargetTable.year,
      month: agentTargetTable.month,
      total: sql<string>`COALESCE(SUM(${agentTargetTable.targetAmount}), 0)`,
    })
    .from(agentTargetTable)
    .where(
      and(
        eq(agentTargetTable.branchId, branchId),
        sql`(${agentTargetTable.year} > ${startYear} OR (${agentTargetTable.year} = ${startYear} AND ${agentTargetTable.month} >= ${startMonth}))
            AND (${agentTargetTable.year} < ${endYear} OR (${agentTargetTable.year} = ${endYear} AND ${agentTargetTable.month} <= ${endMonth}))`,
      ),
    )
    .groupBy(agentTargetTable.year, agentTargetTable.month);

  return { shopTargets, agentTargetSums };
}

// ─── Year view (redesign) ────────────────────────────────────────────────

/** The query surface shared by `db` and a transaction handle. */
export type TargetsExecutor = Pick<typeof db, "select" | "insert" | "delete">;

/** Runs `fn` in one database transaction; any throw rolls every write back. */
export async function withTransaction<T>(fn: (exec: TargetsExecutor) => Promise<T>): Promise<T> {
  return db.transaction((tx) => fn(tx));
}

/** Exact London calendar-year bounds as UTC instants: [start, end). */
function londonYearBounds(year: number): { start: Date; end: Date } {
  const mid = new Date(Date.UTC(year, 5, 15));
  return { start: ukStartOfYear(mid), end: ukStartOfNextYear(mid) };
}

const londonMonth = (col: AnyColumn) => sql<number>`EXTRACT(MONTH FROM ${col} AT TIME ZONE 'Europe/London')::int`;
const bookingActiveCond = sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`;

export async function listBranchesByOrg(orgId: string): Promise<BranchRecord[]> {
  const rows = await db
    .select({
      id: branches.id,
      name: branches.name,
      branchType: branches.branchType,
      ownerUserId: branches.ownerUserId,
      isActive: branches.isActive,
      ownerFirst: user.firstName,
      ownerLast: user.lastName,
    })
    .from(branches)
    .leftJoin(user, eq(user.id, branches.ownerUserId))
    .where(eq(branches.organizationId, orgId));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    branchType: r.branchType === "homeworker" ? "homeworker" : "shop",
    ownerUserId: r.ownerUserId ?? null,
    ownerName: r.ownerUserId ? `${r.ownerFirst ?? ""} ${r.ownerLast ?? ""}`.trim() || null : null,
    isActive: r.isActive !== false,
  }));
}

/** Branches among `branchIds` that belong to the org (foreign ids are simply absent). */
export async function getOrgBranchesByIds(
  orgId: string,
  branchIds: string[],
): Promise<{ id: string; branchType: "shop" | "homeworker" }[]> {
  if (branchIds.length === 0) return [];
  const rows = await db
    .select({ id: branches.id, branchType: branches.branchType })
    .from(branches)
    .where(and(eq(branches.organizationId, orgId), inArray(branches.id, branchIds)));
  return rows.map((r) => ({ id: r.id, branchType: r.branchType === "homeworker" ? "homeworker" : "shop" }));
}

export async function findHomeworkerBranchByOwner(
  orgId: string,
  ownerUserId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: branches.id, name: branches.name })
    .from(branches)
    .where(
      and(
        eq(branches.organizationId, orgId),
        eq(branches.branchType, "homeworker"),
        eq(branches.ownerUserId, ownerUserId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Members (active or not) of the given branches, minus pure social-media managers. */
export async function listMembers(orgId: string, branchIds: string[], userId?: string): Promise<MemberRecord[]> {
  if (branchIds.length === 0) return [];
  const rows = await db
    .select({
      branchId: branchMembers.branchId,
      userId: user.id,
      name: sql<string>`${user.firstName} || ' ' || ${user.lastName}`,
      isActive: branchMembers.isActive,
    })
    .from(branchMembers)
    .innerJoin(user, eq(user.id, branchMembers.userId))
    // `!== undefined`, not truthiness: an empty id must match nothing (fail closed), never everyone.
    .where(and(inArray(branchMembers.branchId, branchIds), userId !== undefined ? eq(branchMembers.userId, userId) : undefined));
  const socialOnly = new Set(await userOrgRolesRepository.findSocialOnlyUserIds({ orgId }));
  return rows
    .filter((r) => !socialOnly.has(r.userId))
    .map((r) => ({ branchId: r.branchId, userId: r.userId, name: r.name, isActive: r.isActive !== false }));
}

/** Which of `userIds` hold a membership (any status) in the branch, minus pure social-media managers. */
export async function getMemberUserIds(branchId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db
    .select({ userId: branchMembers.userId })
    .from(branchMembers)
    .where(and(eq(branchMembers.branchId, branchId), inArray(branchMembers.userId, userIds)));
  const socialOnly = new Set(await userOrgRolesRepository.findSocialOnlyUserIds({ branchId }));
  return new Set(rows.map((r) => r.userId).filter((id) => !socialOnly.has(id)));
}

export async function getOrgTargetsForYear(orgId: string, year: number): Promise<MonthAmountRow[]> {
  return db
    .select({ month: orgTargetTable.month, amount: orgTargetTable.targetAmount })
    .from(orgTargetTable)
    .where(and(eq(orgTargetTable.organizationId, orgId), eq(orgTargetTable.year, year), gt(orgTargetTable.targetAmount, "0")));
}

export async function getShopTargetsForYear(branchIds: string[], year: number): Promise<BranchMonthAmountRow[]> {
  if (branchIds.length === 0) return [];
  return db
    .select({ branchId: shopTargetTable.branchId, month: shopTargetTable.month, amount: shopTargetTable.targetAmount })
    .from(shopTargetTable)
    .where(and(inArray(shopTargetTable.branchId, branchIds), eq(shopTargetTable.year, year)));
}

export async function getAgentTargetRowsForYear(
  branchIds: string[],
  year: number,
  userId?: string,
  exec: TargetsExecutor = db,
  lockForUpdate = false,
): Promise<AgentTargetRowData[]> {
  if (branchIds.length === 0) return [];
  const query = exec
    .select({
      branchId: agentTargetTable.branchId,
      userId: agentTargetTable.userId,
      year: agentTargetTable.year,
      month: agentTargetTable.month,
      targetAmount: agentTargetTable.targetAmount,
      source: agentTargetTable.source,
      selfAmount: agentTargetTable.selfAmount,
      note: agentTargetTable.note,
      updatedBy: agentTargetTable.updatedBy,
      updatedAt: agentTargetTable.updatedAt,
    })
    .from(agentTargetTable)
    .where(
      and(
        inArray(agentTargetTable.branchId, branchIds),
        eq(agentTargetTable.year, year),
        // `!== undefined`: an empty id matches nothing (fail closed).
        userId !== undefined ? eq(agentTargetTable.userId, userId) : undefined,
      ),
    );
  // Row-lock inside a transaction so a self edit and an admin override cannot clobber each other.
  return lockForUpdate ? query.for("update") : query;
}

/**
 * Commission per (branch, agent, London month) for the calendar year, using the
 * agent-dashboard definition: booking package + line-item commission by
 * booking.date_created, plus upsell commission by added_at; test/inactive excluded.
 * Always scoped to branches of `orgId`.
 */
export async function getActualsForYear(orgId: string, year: number, filter: ActualsFilter = {}): Promise<ActualRow[]> {
  if (filter.branchIds && filter.branchIds.length === 0) return [];
  const { start, end } = londonYearBounds(year);

  const baseConds = [
    eq(branches.organizationId, orgId),
    eq(transaction.is_test, false),
    eq(transaction.is_active, true),
    bookingActiveCond,
    filter.branchIds ? inArray(transaction.branch_id, filter.branchIds) : undefined,
    filter.userId !== undefined ? eq(transaction.user_id, filter.userId) : undefined,
  ];

  const bookingMonth = londonMonth(booking.date_created);
  const upsellMonth = londonMonth(booking_upsell.added_at);

  const [bookingRows, upsellRows] = await Promise.all([
    db
      .select({
        branchId: transaction.branch_id,
        userId: transaction.user_id,
        month: bookingMonth,
        amount: sql<string>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(branches, eq(branches.id, transaction.branch_id))
      .where(and(...baseConds, gte(booking.date_created, start), sql`${booking.date_created} < ${end.toISOString()}`))
      .groupBy(transaction.branch_id, transaction.user_id, bookingMonth),
    db
      .select({
        branchId: transaction.branch_id,
        userId: transaction.user_id,
        month: upsellMonth,
        amount: sql<string>`COALESCE(SUM(CAST(${booking_upsell.commission} AS DECIMAL)), 0)`,
      })
      .from(booking_upsell)
      .innerJoin(booking, eq(booking_upsell.booking_id, booking.id))
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(branches, eq(branches.id, transaction.branch_id))
      .where(
        and(
          ...baseConds,
          sql`${booking_upsell.is_active} = true`,
          gte(booking_upsell.added_at, start),
          sql`${booking_upsell.added_at} < ${end.toISOString()}`,
        ),
      )
      .groupBy(transaction.branch_id, transaction.user_id, upsellMonth),
  ]);

  const merged = new Map<string, ActualRow>();
  for (const r of [...bookingRows, ...upsellRows]) {
    if (!r.branchId) continue;
    const key = `${r.branchId}|${r.userId}|${r.month}`;
    const amount = Number(r.amount);
    const prev = merged.get(key);
    if (prev) prev.amount += amount;
    else merged.set(key, { branchId: r.branchId, userId: r.userId, month: Number(r.month), amount });
  }
  return Array.from(merged.values());
}

// ─── Writes (all take an executor so a service can wrap them in one transaction) ───

/** A £0 business month means "not set": it is deleted, and only months above 0 are stored. */
export async function upsertOrgTargets(exec: TargetsExecutor, orgId: string, year: number, months: number[]) {
  const zeroMonths = months.flatMap((m, i) => (m > 0 ? [] : [i + 1]));
  if (zeroMonths.length > 0) {
    await exec
      .delete(orgTargetTable)
      .where(
        and(
          eq(orgTargetTable.organizationId, orgId),
          eq(orgTargetTable.year, year),
          inArray(orgTargetTable.month, zeroMonths),
        ),
      );
  }
  const set = months.flatMap((m, i) => (m > 0 ? [{ organizationId: orgId, year, month: i + 1, targetAmount: String(m) }] : []));
  if (set.length === 0) return;
  await exec
    .insert(orgTargetTable)
    .values(set)
    .onConflictDoUpdate({
      target: [orgTargetTable.organizationId, orgTargetTable.year, orgTargetTable.month],
      set: { targetAmount: sql`excluded.target_amount`, updatedAt: new Date() },
    });
}

export async function upsertShopTargetMonths(exec: TargetsExecutor, branchId: string, year: number, months: number[]) {
  await exec
    .insert(shopTargetTable)
    .values(months.map((m, i) => ({ branchId, year, month: i + 1, targetAmount: String(m) })))
    .onConflictDoUpdate({
      target: [shopTargetTable.branchId, shopTargetTable.year, shopTargetTable.month],
      set: { targetAmount: sql`excluded.target_amount`, updatedAt: new Date() },
    });
}

/** Plain agent allocation: sets the effective amount, leaves any override metadata alone. */
export async function upsertAgentTargetMonths(
  exec: TargetsExecutor,
  branchId: string,
  userId: string,
  year: number,
  months: number[],
  updatedBy: string | null,
) {
  await exec
    .insert(agentTargetTable)
    .values(months.map((m, i) => ({ branchId, userId, year, month: i + 1, targetAmount: String(m), updatedBy })))
    .onConflictDoUpdate({
      target: [agentTargetTable.branchId, agentTargetTable.userId, agentTargetTable.year, agentTargetTable.month],
      set: { targetAmount: sql`excluded.target_amount`, updatedBy: sql`excluded.updated_by`, updatedAt: new Date() },
    });
}

/** Full-row upsert used by the homeworker self/override/revert flows. */
export async function upsertAgentTargetRows(exec: TargetsExecutor, rows: AgentTargetRowWrite[]) {
  if (rows.length === 0) return;
  await exec
    .insert(agentTargetTable)
    .values(rows)
    .onConflictDoUpdate({
      target: [agentTargetTable.branchId, agentTargetTable.userId, agentTargetTable.year, agentTargetTable.month],
      set: {
        targetAmount: sql`excluded.target_amount`,
        source: sql`excluded.source`,
        selfAmount: sql`excluded.self_amount`,
        note: sql`excluded.note`,
        updatedBy: sql`excluded.updated_by`,
        updatedAt: new Date(),
      },
    });
}

export async function deleteAgentTargetRows(
  exec: TargetsExecutor,
  branchId: string,
  userId: string,
  year: number,
  months: number[],
) {
  if (months.length === 0) return;
  await exec
    .delete(agentTargetTable)
    .where(
      and(
        eq(agentTargetTable.branchId, branchId),
        eq(agentTargetTable.userId, userId),
        eq(agentTargetTable.year, year),
        inArray(agentTargetTable.month, months),
      ),
    );
}
