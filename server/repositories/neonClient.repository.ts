import { db } from "../config/database";
import { clientTable, transaction, type NeonClient, type InsertClientTable } from "@shared/schema";
import { eq, desc, sql, count, or, ilike, getTableColumns } from "drizzle-orm";

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

export const neonClientRepository = {
  async findById(id: string): Promise<NeonClient | undefined> {
    const [result] = await db.select().from(clientTable).where(eq(clientTable.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<NeonClient[]> {
    return await db.select().from(clientTable).orderBy(desc(clientTable.createdAt));
  },

  async findPaginated(page: number, limit: number, search?: string): Promise<{ clients: NeonClient[]; total: number }> {
    const offset = (page - 1) * limit;

    const whereClause = search
      ? or(
          ilike(clientTable.firstName, `%${search}%`),
          ilike(clientTable.surename, `%${search}%`),
          ilike(clientTable.email, `%${search}%`),
          ilike(clientTable.phoneNumber, `%${search}%`),
          ilike(clientTable.city, `%${search}%`),
          ilike(clientTable.country, `%${search}%`),
        )
      : undefined;

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

  async create(client: InsertClientTable): Promise<NeonClient> {
    const [result] = await db.insert(clientTable).values(client).returning();
    return result;
  },

  async update(id: string, client: Partial<InsertClientTable>): Promise<NeonClient | undefined> {
    const [result] = await db.update(clientTable).set(client).where(eq(clientTable.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(clientTable).where(eq(clientTable.id, id));
  },

  async bulkUpsert(clients: NeonClientWithId[]): Promise<{ imported: number; errors: Array<{ row: number; id: string; error: string }> }> {
    const errors: Array<{ row: number; id: string; error: string }> = [];
    let imported = 0;

    for (let batchStart = 0; batchStart < clients.length; batchStart += BATCH_SIZE) {
      const batch = clients.slice(batchStart, batchStart + BATCH_SIZE);
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
