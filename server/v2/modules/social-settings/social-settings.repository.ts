import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { orgSocialSettings, type OrgSocialSettings } from "@shared/schema";
import type { SocialSettingsInput } from "./social-settings.types";

// Repository: one social-settings row per org (org_social_settings).

export const socialSettingsRepository = {
  async findByOrg(orgId: string): Promise<OrgSocialSettings | null> {
    const [row] = await db.select().from(orgSocialSettings).where(eq(orgSocialSettings.orgId, orgId));
    return row ?? null;
  },

  async upsert(orgId: string, data: SocialSettingsInput, userId: string | null): Promise<OrgSocialSettings> {
    const [row] = await db
      .insert(orgSocialSettings)
      .values({ ...data, orgId, updatedBy: userId })
      .onConflictDoUpdate({
        target: orgSocialSettings.orgId,
        set: { ...data, orgId, updatedBy: userId, updatedAt: new Date() },
      })
      .returning();
    return row;
  },
};
