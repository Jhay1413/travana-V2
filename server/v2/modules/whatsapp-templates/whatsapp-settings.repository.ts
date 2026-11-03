import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { orgWhatsappSettings, type OrgWhatsappSettings, type InsertOrgWhatsappSettings } from "@shared/schema";

// Repository: one WhatsApp-settings row per org (org_whatsapp_settings). It holds
// both the quote template and the general-update template; a write only sets the
// columns it is given, so saving one never overwrites the other.

export type WhatsappSettingsInput = Partial<
  Pick<
    InsertOrgWhatsappSettings,
    | "quoteTemplateName"
    | "quoteTemplateLanguage"
    | "quoteTemplateChannelId"
    | "quoteTemplateVariables"
    | "updateTemplateName"
    | "updateTemplateLanguage"
    | "updateTemplateChannelId"
    | "updateTemplateVariables"
  >
>;

export const whatsappSettingsRepository = {
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
        set: { ...data, updatedBy: userId, updatedAt: new Date() },
      })
      .returning();
    return row;
  },
};
