import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { sendsevenIntegrations, type SendsevenIntegration } from "@shared/schema";

// Repository: DB access for a per-org SendSeven integration (one row per org).

export interface UpsertIntegrationData {
  orgId: string;
  encryptedToken: string;
  baseUrl: string | null;
  createdByUserId: string | null;
}

export const conversationIntegrationRepository = {
  async findByOrg(orgId: string): Promise<SendsevenIntegration | null> {
    const [row] = await db.select().from(sendsevenIntegrations).where(eq(sendsevenIntegrations.orgId, orgId));
    return row ?? null;
  },

  async upsert(data: UpsertIntegrationData): Promise<SendsevenIntegration> {
    const [row] = await db
      .insert(sendsevenIntegrations)
      .values({
        orgId: data.orgId,
        encryptedToken: data.encryptedToken,
        baseUrl: data.baseUrl,
        createdByUserId: data.createdByUserId,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: sendsevenIntegrations.orgId,
        set: {
          encryptedToken: data.encryptedToken,
          baseUrl: data.baseUrl,
          isActive: true,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },

  async deleteByOrg(orgId: string): Promise<void> {
    await db.delete(sendsevenIntegrations).where(eq(sendsevenIntegrations.orgId, orgId));
  },
};
