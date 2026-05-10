import { db } from "../../config/database";
import {
  shopTargetTable,
  agentTargetTable,
  user,
  branchMembers,
  branches,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { ShopTargetInput, AgentTargetInput, AgentInfo } from "./targets.types";

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

export async function upsertShopTarget(branchId: string, target: ShopTargetInput) {
  const existing = await db
    .select()
    .from(shopTargetTable)
    .where(
      and(
        eq(shopTargetTable.branchId, branchId),
        eq(shopTargetTable.year, target.year),
        eq(shopTargetTable.month, target.month),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return await db
      .update(shopTargetTable)
      .set({ targetAmount: target.targetAmount, updatedAt: new Date() })
      .where(eq(shopTargetTable.id, existing[0].id))
      .returning();
  } else {
    return await db
      .insert(shopTargetTable)
      .values({ branchId, ...target })
      .returning();
  }
}

export async function bulkUpsertShopTargets(branchId: string, targets: ShopTargetInput[]) {
  const results = [];
  for (const target of targets) {
    const result = await upsertShopTarget(branchId, target);
    results.push(result[0]);
  }
  return results;
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

export async function upsertAgentTarget(branchId: string, target: AgentTargetInput) {
  const existing = await db
    .select()
    .from(agentTargetTable)
    .where(
      and(
        eq(agentTargetTable.branchId, branchId),
        eq(agentTargetTable.userId, target.userId),
        eq(agentTargetTable.year, target.year),
        eq(agentTargetTable.month, target.month),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return await db
      .update(agentTargetTable)
      .set({ targetAmount: target.targetAmount, updatedAt: new Date() })
      .where(eq(agentTargetTable.id, existing[0].id))
      .returning();
  } else {
    return await db
      .insert(agentTargetTable)
      .values({ branchId, ...target })
      .returning();
  }
}

export async function bulkUpsertAgentTargets(branchId: string, targets: AgentTargetInput[]) {
  const results = [];
  for (const target of targets) {
    const result = await upsertAgentTarget(branchId, target);
    results.push(result[0]);
  }
  return results;
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

  return agents;
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
