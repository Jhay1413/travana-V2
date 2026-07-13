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

  async findAll(): Promise<SendsevenIntegration[]> {
    return db.select().from(sendsevenIntegrations);
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

  // Links the org to a SendSeven tenant without touching the token (used by
  // onboarding auto-provisioning). Creates a token-less row if none exists.
  async setTenantId(orgId: string, tenantId: string): Promise<SendsevenIntegration> {
    const [row] = await db
      .insert(sendsevenIntegrations)
      .values({ orgId, tenantId, isActive: true })
      .onConflictDoUpdate({
        target: sendsevenIntegrations.orgId,
        set: { tenantId, updatedAt: new Date() },
      })
      .returning();
    return row;
  },

  // Stores the registered webhook (endpoint id + encrypted secret) and turns
  // auto-reply on. Requires an existing row (the org must be provisioned first).
  async setWebhook(
    orgId: string,
    data: { webhookEndpointId: string; webhookSecret: string; autoReplyMode?: string },
  ): Promise<SendsevenIntegration> {
    const [row] = await db
      .update(sendsevenIntegrations)
      .set({
        webhookEndpointId: data.webhookEndpointId,
        webhookSecret: data.webhookSecret,
        autoReplyEnabled: true,
        ...(data.autoReplyMode ? { autoReplyMode: data.autoReplyMode } : {}),
        updatedAt: new Date(),
      })
      .where(eq(sendsevenIntegrations.orgId, orgId))
      .returning();
    return row;
  },

  // Updates just the auto-reply mode ('draft' | 'send') without re-registering.
  async setAutoReplyMode(orgId: string, mode: string): Promise<void> {
    await db
      .update(sendsevenIntegrations)
      .set({ autoReplyMode: mode, updatedAt: new Date() })
      .where(eq(sendsevenIntegrations.orgId, orgId));
  },

  // Clears the webhook + disables auto-reply (keeps the token/tenant link).
  async clearWebhook(orgId: string): Promise<void> {
    await db
      .update(sendsevenIntegrations)
      .set({ webhookEndpointId: null, webhookSecret: null, autoReplyEnabled: false, updatedAt: new Date() })
      .where(eq(sendsevenIntegrations.orgId, orgId));
  },

  async deleteByOrg(orgId: string): Promise<void> {
    await db.delete(sendsevenIntegrations).where(eq(sendsevenIntegrations.orgId, orgId));
  },
};
