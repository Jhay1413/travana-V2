import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { orgWhatsappSettings, type OrgWhatsappSettings, type InsertOrgWhatsappSettings } from "@shared/schema";

// Repository: one WhatsApp-settings row per org (org_whatsapp_settings).

export type WhatsappSettingsInput = Pick<
  InsertOrgWhatsappSettings,
  "quoteTemplateName" | "quoteTemplateLanguage" | "quoteTemplateChannelId" | "quoteTemplateVariables"
>;

export const quoteWhatsappSettingsRepository = {
  async findByOrg(orgId: string): Promise<OrgWhatsappSettings | null> {
    const [row] = await db.select().from(orgWhatsappSettings).where(eq(orgWhatsappSettings.orgId, orgId));
    return row ?? null;
  },

  async upsert(orgId: string, data: WhatsappSettingsInput, userId: string | null): Promise<OrgWhatsappSettings> {
    const [row] = await db
      .insert(orgWhatsappSettings)
      .values({ ...data, orgId, updatedBy: userId })
      .onConflictDoUpdate({
        target: orgWhatsappSettings.orgId,
        set: { ...data, orgId, updatedBy: userId, updatedAt: new Date() },
      })
      .returning();
    return row;
  },
};
