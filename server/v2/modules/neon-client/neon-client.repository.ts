import { db } from "../../config/database";
import { clientTable, transaction, type NeonClient, type InsertClientTable } from "@shared/schema";
import { eq, desc, sql, count, or, and, ilike, getTableColumns, type SQL } from "drizzle-orm";
import type { Scope } from "../../utils/scope";

export type NeonClientWithId = InsertClientTable & { id: string };

const BATCH_SIZE = 100;

const upsertSet = {
  title: sql`excluded."title"`,
  firstName: sql`excluded."firstName"`,
  surename: sql`excluded."surename"`,
  DOB: sql`excluded."DOB"`,
  phoneNumber: sql`excluded."phoneNumber"`,
  email: sql`excluded."email"`,
  emailIsAllowed: sql`excluded."emailIsAllowed"`,
  VMB: sql`excluded."VMB"`,
  VMBfirstAccess: sql`excluded."VMBfirstAccess"`,
  whatsAppVerified: sql`excluded."whatsAppVerified"`,
  mailAllowed: sql`excluded."mailAllowed"`,
  houseNumber: sql`excluded."houseNumber"`,
  city: sql`excluded."city"`,
  street: sql`excluded."street"`,
  country: sql`excluded."country"`,
  post_code: sql`excluded."post_code"`,
  avatarUrl: sql`excluded."avatarUrl"`,
  badge: sql`excluded."badge"`,
  referrerId: sql`excluded."referrerId"`,
};

function buildClientScopeConds(scope?: Scope): SQL[] {
  const conds: SQL[] = [];
  if (!scope || scope.orgRole === "platform_admin") return conds;
  conds.push(eq(clientTable.orgId, scope.orgId));
  if (scope.orgRole === "branch_manager" && scope.branchId) {
    conds.push(eq(clientTable.branchId, scope.branchId));
  }
  if (scope.orgRole === "homeworker" && scope.userId) {
    conds.push(eq(clientTable.createdBy, scope.userId));
  }
  return conds;
}

export const neonClientRepository = {
  async findById(id: string, scope?: Scope): Promise<NeonClient | undefined> {
    const conds: SQL[] = [eq(clientTable.id, id), ...buildClientScopeConds(scope)];
    const [result] = await db.select().from(clientTable).where(and(...conds)).limit(1);
    return result;
  },

  /** Lightweight VIP-fields lookup used by enrollment. */
  async findVipEnrolledAt(id: string): Promise<{ vipEnrolledAt: Date | null } | undefined> {
    const [row] = await db
      .select({ vipEnrolledAt: clientTable.vipEnrolledAt })
      .from(clientTable)
      .where(eq(clientTable.id, id))
      .limit(1);
    return row;
  },

  /** Initialise VIP fields on a client (no-op if already enrolled). */
  async enrollVip(id: string): Promise<void> {
    await db
      .update(clientTable)
      .set({ vipTier: 'standard', vipEnrolledAt: new Date(), totalReferrals: 0 })
      .where(eq(clientTable.id, id));
  },

  async setVipTotalsAndTier(id: string, totalReferrals: number, vipTier: 'standard' | 'gold' | 'elite'): Promise<void> {
    await db
      .update(clientTable)
      .set({ totalReferrals, vipTier })
      .where(eq(clientTable.id, id));
  },

  async findPortalPin(id: string): Promise<{ portalPin: string | null } | undefined> {
    const [row] = await db
      .select({ portalPin: clientTable.portalPin })
      .from(clientTable)
      .where(eq(clientTable.id, id))
      .limit(1);
    return row;
  },

  async setPortalPin(id: string, hash: string | null, opts?: { mustChange?: boolean }): Promise<void> {
    // Default the flag to false: staff-set / client-chosen PINs are final, only
    // a system-seeded default (mustChange: true) requires a forced change.
    await db
      .update(clientTable)
      .set({ portalPin: hash, mustChangePin: opts?.mustChange ?? false })
      .where(eq(clientTable.id, id));
  },

  async findAll(scope?: Scope): Promise<NeonClient[]> {
    const conds = buildClientScopeConds(scope);
    const query = db.select().from(clientTable);
    return conds.length > 0
      ? await query.where(and(...conds)).orderBy(desc(clientTable.createdAt))
      : await query.orderBy(desc(clientTable.createdAt));
  },

  async findPaginated(page: number, limit: number, search?: string, scope?: Scope): Promise<{ clients: NeonClient[]; total: number }> {
    const offset = (page - 1) * limit;

    const words = search ? search.trim().split(/\s+/).filter(Boolean) : [];
    const wordTerms = words.map((w) => `%${w}%`);

    const searchClause = search
      ? or(
          ...wordTerms.map((t) => ilike(clientTable.firstName, t)),
          ...wordTerms.map((t) => ilike(clientTable.surename, t)),
          ilike(clientTable.email, `%${search}%`),
          ilike(clientTable.phoneNumber, `%${search}%`),
          ilike(clientTable.city, `%${search}%`),
          ilike(clientTable.country, `%${search}%`),
          sql`concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename}) ilike ${`%${search}%`}`,
        )
      : undefined;

    const scopeConds = buildClientScopeConds(scope);
    const allConds: SQL[] = [...scopeConds];
    if (searchClause) allConds.push(searchClause);
    const whereClause = allConds.length > 0 ? and(...allConds) : undefined;

    const latestTransaction = db
      .select({
        clientId: transaction.client_id,
        latestActivity: sql<string>`MAX(${transaction.created_at})`.as("latest_activity"),
      })
      .from(transaction)
      .groupBy(transaction.client_id)
      .as("latest_tx");

    const clientColumns = getTableColumns(clientTable);

    const [clients, totalResult] = await Promise.all([
      db.select({ ...clientColumns })
        .from(clientTable)
        .leftJoin(latestTransaction, eq(clientTable.id, latestTransaction.clientId))
        .where(whereClause)
        .orderBy(
          sql`${latestTransaction.latestActivity} IS NULL ASC`,
          desc(sql`${latestTransaction.latestActivity}`),
          desc(clientTable.createdAt)
        )
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(clientTable)
        .where(whereClause),
    ]);

    return { clients, total: totalResult[0]?.total ?? 0 };
  },

  async create(client: InsertClientTable, scope?: Scope): Promise<NeonClient> {
    const values: InsertClientTable = scope
      ? ({
          ...client,
          orgId: (client as any).orgId ?? scope.orgId ?? null,
          branchId: (client as any).branchId ?? scope.branchId ?? null,
          createdBy: (client as any).createdBy ?? scope.userId ?? null,
        } as InsertClientTable)
      : client;
    const [result] = await db.insert(clientTable).values(values).returning();
    return result;
  },

  async update(id: string, client: Partial<InsertClientTable>, scope?: Scope): Promise<NeonClient | undefined> {
    const conds: SQL[] = [eq(clientTable.id, id), ...buildClientScopeConds(scope)];
    const [result] = await db.update(clientTable).set(client).where(and(...conds)).returning();
    return result;
  },

  async remove(id: string, scope?: Scope): Promise<boolean> {
    const conds: SQL[] = [eq(clientTable.id, id), ...buildClientScopeConds(scope)];
    const result = await db.delete(clientTable).where(and(...conds)).returning({ id: clientTable.id });
    return result.length > 0;
  },

  async bulkUpsert(clients: NeonClientWithId[], scope?: Scope): Promise<{ imported: number; errors: Array<{ row: number; id: string; error: string }> }> {
    const errors: Array<{ row: number; id: string; error: string }> = [];
    let imported = 0;

    const stamped = scope
      ? clients.map((c) => ({
          ...c,
          orgId: (c as any).orgId ?? scope.orgId ?? null,
          branchId: (c as any).branchId ?? scope.branchId ?? null,
          createdBy: (c as any).createdBy ?? scope.userId ?? null,
        }))
      : clients;

    for (let batchStart = 0; batchStart < stamped.length; batchStart += BATCH_SIZE) {
      const batch = stamped.slice(batchStart, batchStart + BATCH_SIZE);
      try {
        await db
          .insert(clientTable)
          .values(batch)
          .onConflictDoUpdate({
            target: clientTable.id,
            set: upsertSet,
          });
        imported += batch.length;
      } catch {
        for (let i = 0; i < batch.length; i++) {
          const client = batch[i]!;
          try {
            await db
              .insert(clientTable)
              .values(client)
              .onConflictDoUpdate({
                target: clientTable.id,
                set: upsertSet,
              });
            imported++;
          } catch (rowErr: any) {
            errors.push({
              row: batchStart + i + 1,
              id: client.id,
              error: rowErr.message || "Unknown error",
            });
          }
        }
      }
    }

    return { imported, errors };
  },
};
