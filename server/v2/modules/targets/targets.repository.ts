import { db } from "../../config/database";
import {
  shopTargetTable,
  agentTargetTable,
  user,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { ShopTargetInput, AgentTargetInput, AgentInfo } from "./targets.types";

export async function getAllShopTargets() {
  return await db
    .select()
    .from(shopTargetTable)
    .orderBy(shopTargetTable.year, shopTargetTable.month);
}

export async function getShopTargetsByDateRange(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  return await db
    .select()
    .from(shopTargetTable)
    .where(
      sql`(${shopTargetTable.year} > ${startYear} OR (${shopTargetTable.year} = ${startYear} AND ${shopTargetTable.month} >= ${startMonth}))
          AND (${shopTargetTable.year} < ${endYear} OR (${shopTargetTable.year} = ${endYear} AND ${shopTargetTable.month} <= ${endMonth}))`
    )
    .orderBy(shopTargetTable.year, shopTargetTable.month);
}

export async function upsertShopTarget(target: ShopTargetInput) {
  const existing = await db
    .select()
    .from(shopTargetTable)
    .where(
      and(
        eq(shopTargetTable.year, target.year),
        eq(shopTargetTable.month, target.month)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return await db
      .update(shopTargetTable)
      .set({
        targetAmount: target.targetAmount,
        updatedAt: new Date(),
      })
      .where(eq(shopTargetTable.id, existing[0].id))
      .returning();
  } else {
    return await db
      .insert(shopTargetTable)
      .values(target)
      .returning();
  }
}

export async function bulkUpsertShopTargets(targets: ShopTargetInput[]) {
  const results = [];
  for (const target of targets) {
    const result = await upsertShopTarget(target);
    results.push(result[0]);
  }
  return results;
}

export async function getAllAgentTargets() {
  return await db
    .select()
    .from(agentTargetTable)
    .orderBy(agentTargetTable.year, agentTargetTable.month);
}

export async function getAgentTargetsByDateRange(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  return await db
    .select()
    .from(agentTargetTable)
    .where(
      sql`(${agentTargetTable.year} > ${startYear} OR (${agentTargetTable.year} = ${startYear} AND ${agentTargetTable.month} >= ${startMonth}))
          AND (${agentTargetTable.year} < ${endYear} OR (${agentTargetTable.year} = ${endYear} AND ${agentTargetTable.month} <= ${endMonth}))`
    )
    .orderBy(agentTargetTable.year, agentTargetTable.month);
}

export async function getAgentTargetsByUserId(userId: string) {
  return await db
    .select()
    .from(agentTargetTable)
    .where(eq(agentTargetTable.userId, userId))
    .orderBy(agentTargetTable.year, agentTargetTable.month);
}

export async function upsertAgentTarget(target: AgentTargetInput) {
  const existing = await db
    .select()
    .from(agentTargetTable)
    .where(
      and(
        eq(agentTargetTable.userId, target.userId),
        eq(agentTargetTable.year, target.year),
        eq(agentTargetTable.month, target.month)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return await db
      .update(agentTargetTable)
      .set({
        targetAmount: target.targetAmount,
        updatedAt: new Date(),
      })
      .where(eq(agentTargetTable.id, existing[0].id))
      .returning();
  } else {
    return await db
      .insert(agentTargetTable)
      .values(target)
      .returning();
  }
}

export async function bulkUpsertAgentTargets(targets: AgentTargetInput[]) {
  const results = [];
  for (const target of targets) {
    const result = await upsertAgentTarget(target);
    results.push(result[0]);
  }
  return results;
}

export async function getAllAgents(): Promise<AgentInfo[]> {
  const agents = await db
    .select({
      id: user.id,
      name: sql<string>`${user.firstName} || ' ' || ${user.lastName}`,
      email: user.email,
      role: user.role,
    })
    .from(user);

  return agents;
}

export async function getTargetSummaryByDateRange(startYear: number, startMonth: number, endYear: number, endMonth: number) {
  const shopTargets = await getShopTargetsByDateRange(startYear, startMonth, endYear, endMonth);

  const agentTargetSums = await db
    .select({
      year: agentTargetTable.year,
      month: agentTargetTable.month,
      total: sql<string>`COALESCE(SUM(${agentTargetTable.targetAmount}), 0)`,
    })
    .from(agentTargetTable)
    .where(
      sql`(${agentTargetTable.year} > ${startYear} OR (${agentTargetTable.year} = ${startYear} AND ${agentTargetTable.month} >= ${startMonth}))
          AND (${agentTargetTable.year} < ${endYear} OR (${agentTargetTable.year} = ${endYear} AND ${agentTargetTable.month} <= ${endMonth}))`
    )
    .groupBy(agentTargetTable.year, agentTargetTable.month);

  return { shopTargets, agentTargetSums };
}
