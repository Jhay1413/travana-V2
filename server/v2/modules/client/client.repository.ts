import { db } from "../../config/database";
import { clientTable, type NeonClient as Client, type InsertClientTable as InsertClient } from "@shared/schema";
import { eq, desc, and, type SQL } from "drizzle-orm";
import type { Scope } from "../../utils/scope";

function buildScopeWhere(scope: Scope): SQL | undefined {
  if (scope.orgRole === "platform_admin") return undefined;

  const conds: SQL[] = [eq(clientTable.orgId, scope.orgId)];
  if (scope.orgRole === "branch_manager" && scope.branchId) {
    conds.push(eq(clientTable.branchId, scope.branchId));
  }
  if ((scope.orgRole === "agent" || scope.orgRole === "homeworker") && scope.userId) {
    conds.push(eq(clientTable.createdBy, scope.userId));
  }
  return and(...conds);
}

export const clientRepository = {
  async findById(id: string, scope: Scope): Promise<Client | undefined> {
    const scopeWhere = buildScopeWhere(scope);
    const where = scopeWhere ? and(eq(clientTable.id, id), scopeWhere) : eq(clientTable.id, id);
    const [result] = await db.select().from(clientTable).where(where).limit(1);
    return result;
  },

  async findAll(scope: Scope): Promise<Client[]> {
    const where = buildScopeWhere(scope);
    const query = db.select().from(clientTable);
    const rows = where
      ? await query.where(where).orderBy(desc(clientTable.createdAt))
      : await query.orderBy(desc(clientTable.createdAt));
    return rows;
  },

  async create(client: InsertClient, scope: Scope): Promise<Client> {
    const values: InsertClient = {
      ...client,
      orgId: scope.orgId || (client as any).orgId || null,
      branchId: scope.branchId ?? (client as any).branchId ?? null,
      createdBy: scope.userId ?? (client as any).createdBy ?? null,
    } as InsertClient;
    const [result] = await db.insert(clientTable).values(values).returning();
    return result;
  },

  async update(id: string, client: Partial<InsertClient>, scope: Scope): Promise<Client | undefined> {
    const scopeWhere = buildScopeWhere(scope);
    const where = scopeWhere ? and(eq(clientTable.id, id), scopeWhere) : eq(clientTable.id, id);
    const [result] = await db.update(clientTable).set(client).where(where).returning();
    return result;
  },

  async remove(id: string, scope: Scope): Promise<boolean> {
    const scopeWhere = buildScopeWhere(scope);
    const where = scopeWhere ? and(eq(clientTable.id, id), scopeWhere) : eq(clientTable.id, id);
    const result = await db.delete(clientTable).where(where).returning({ id: clientTable.id });
    return result.length > 0;
  },
};
