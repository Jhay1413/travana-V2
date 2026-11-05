import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { orgSocialSettings, organization, quote, transaction, travel_deal, type OrgSocialSettings } from "@shared/schema";
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

  /** The agency a social post belongs to (through its quote's transaction). */
  async findOrgIdForDeal(dealId: string): Promise<string | null> {
    const [row] = await db
      .select({ orgId: transaction.org_id })
      .from(travel_deal)
      .leftJoin(quote, eq(travel_deal.quote_id, quote.id))
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(eq(travel_deal.id, dealId))
      .limit(1);
    return row?.orgId ?? null;
  },

  async orgExists(orgId: string): Promise<boolean> {
    const [row] = await db.select({ id: organization.id }).from(organization).where(eq(organization.id, orgId)).limit(1);
    return !!row;
  },

  /** Platform-admin write: sets only the allow-list, leaving the agency's own defaults untouched. */
  async setAllowedAccountIds(orgId: string, ids: number[] | null, userId: string | null): Promise<OrgSocialSettings> {
    const [row] = await db
      .insert(orgSocialSettings)
      .values({ orgId, allowedAccountIds: ids, updatedBy: userId })
      .onConflictDoUpdate({
        target: orgSocialSettings.orgId,
        set: { allowedAccountIds: ids, updatedBy: userId, updatedAt: new Date() },
      })
      .returning();
    return row;
  },
};
