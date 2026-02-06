import { db } from "../config/database";
import { clientTable, type NeonClient, type InsertClientTable } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export type NeonClientWithId = InsertClientTable & { id: string };

export const neonClientRepository = {
  async findById(id: string): Promise<NeonClient | undefined> {
    const [result] = await db.select().from(clientTable).where(eq(clientTable.id, id)).limit(1);
    return result;
  },

  async findAll(): Promise<NeonClient[]> {
    return await db.select().from(clientTable).orderBy(desc(clientTable.createdAt));
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

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i]!;
      try {
        await db
          .insert(clientTable)
          .values(client)
          .onConflictDoUpdate({
            target: clientTable.id,
            set: {
              title: client.title,
              firstName: client.firstName,
              surename: client.surename,
              DOB: client.DOB,
              phoneNumber: client.phoneNumber,
              email: client.email,
              emailIsAllowed: client.emailIsAllowed,
              VMB: client.VMB,
              VMBfirstAccess: client.VMBfirstAccess,
              whatsAppVerified: client.whatsAppVerified,
              mailAllowed: client.mailAllowed,
              houseNumber: client.houseNumber,
              city: client.city,
              street: client.street,
              country: client.country,
              post_code: client.post_code,
              avatarUrl: client.avatarUrl,
              badge: client.badge,
              referrerId: client.referrerId,
            },
          });
        imported++;
      } catch (err: any) {
        errors.push({ row: i + 1, id: client.id, error: err.message || "Unknown error" });
      }
    }

    return { imported, errors };
  },
};
