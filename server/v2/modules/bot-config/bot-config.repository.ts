import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { orgBotConfig, type OrgBotConfig } from "@shared/schema";

// Repository: one bot-config row per org (org_bot_config).

export type BotConfigInput = Partial<
  Pick<OrgBotConfig, "name" | "avatarUrl" | "persona" | "preferredResponse" | "greeting" | "signOff" | "language" | "handoffInstructions">
>;

export const botConfigRepository = {
  async findByOrg(orgId: string): Promise<OrgBotConfig | null> {
    const [row] = await db.select().from(orgBotConfig).where(eq(orgBotConfig.orgId, orgId));
    return row ?? null;
  },

  async upsert(orgId: string, data: BotConfigInput, userId: string | null): Promise<OrgBotConfig> {
    const [row] = await db
      .insert(orgBotConfig)
      .values({ orgId, ...data, updatedBy: userId })
      .onConflictDoUpdate({
        target: orgBotConfig.orgId,
        set: { ...data, updatedBy: userId, updatedAt: new Date() },
      })
      .returning();
    return row;
  },
};
