import { db } from "../../config/database";
import {
  shopTargetTable,
  agentTargetTable,
  user,
  branchMembers,
  branches,
} from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import type { ShopTargetInput, AgentTargetInput, AgentInfo } from "./targets.types";
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

export async function getTargetSummaryByDateRange(branchId: string, startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const shopTargets = await getShopTargetsByDateRange(branchId, startYear, startMonth, endYear, endMonth);

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
