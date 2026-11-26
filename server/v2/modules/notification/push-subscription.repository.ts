import { db } from "../../config/database";
import { pushSubscriptions, clientTable } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

export const pushSubscriptionRepository = {
  /** Subscriptions of live customers of one agency. A subscription whose customer has no agency (or is deleted) is never returned. */
  async findByOrgId(orgId: string) {
    const rows = await db
      .select({ sub: pushSubscriptions })
      .from(pushSubscriptions)
      .innerJoin(clientTable, eq(pushSubscriptions.clientId, clientTable.id))
      .where(and(eq(clientTable.orgId, orgId), isNull(clientTable.deletedAt)));
    return rows.map((r) => r.sub);
  },

  async findByClientId(clientId: string) {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.clientId, clientId));
  },

  async upsert(input: { clientId: string; endpoint: string; p256dh: string; auth: string }): Promise<void> {
    // Endpoint is unique-ish (the subscription's identity) — drop any existing row
    // before inserting the new one so re-subscribes don't accumulate stale keys.
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, input.endpoint));
    await db.insert(pushSubscriptions).values(input);
  },

  async removeByClientAndEndpoint(clientId: string, endpoint: string): Promise<void> {
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.clientId, clientId), eq(pushSubscriptions.endpoint, endpoint)));
  },

  async removeById(id: string): Promise<void> {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, id));
  },
};
