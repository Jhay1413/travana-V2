import { db, pool } from "../../config/database";
import {
  aiUsageEvent,
  aiUsageMonthly,
  sendsevenMessageUsage,
  orgUsageLimits,
  modelPricing,
  type AiUsageMonthly,
  type SendsevenMessageUsage,
  type OrgUsageLimits,
  type InsertOrgUsageLimits,
  type ModelPricing,
} from "@shared/schema";
import { and, desc, eq, lte, sql } from "drizzle-orm";

export interface InsertEventParams {
  orgId: string;
  feature: string;
  site?: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  totalTokens: number;
  costMicros: number;
  conversationId?: string;
  userId?: string | null;
}

export interface AiMonthlyDeltas {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  messageCount: number;
  costMicros: number;
}

export interface SendsevenConsumeResult {
  sentCount: number;
  aiSentCount: number;
}

export const usageRepository = {
  async insertEvent(params: InsertEventParams): Promise<void> {
    await db.insert(aiUsageEvent).values({
      orgId: params.orgId,
      feature: params.feature,
      site: params.site,
      model: params.model,
      promptTokens: params.promptTokens,
      completionTokens: params.completionTokens,
      cachedTokens: params.cachedTokens,
      totalTokens: params.totalTokens,
      costMicros: params.costMicros,
      conversationId: params.conversationId,
      userId: params.userId ?? null,
    });
  },

  /** Atomic upsert: create the monthly aggregate row if missing, else add the deltas. */
  async incrementAiMonthly(orgId: string, periodStart: string, deltas: AiMonthlyDeltas): Promise<void> {
    await db
      .insert(aiUsageMonthly)
      .values({
        orgId,
        periodStart,
        promptTokens: deltas.promptTokens,
        completionTokens: deltas.completionTokens,
        totalTokens: deltas.totalTokens,
        messageCount: deltas.messageCount,
        costMicros: deltas.costMicros,
      })
      .onConflictDoUpdate({
        target: [aiUsageMonthly.orgId, aiUsageMonthly.periodStart],
        set: {
          promptTokens: sql`${aiUsageMonthly.promptTokens} + ${deltas.promptTokens}`,
          completionTokens: sql`${aiUsageMonthly.completionTokens} + ${deltas.completionTokens}`,
          totalTokens: sql`${aiUsageMonthly.totalTokens} + ${deltas.totalTokens}`,
          messageCount: sql`${aiUsageMonthly.messageCount} + ${deltas.messageCount}`,
          costMicros: sql`${aiUsageMonthly.costMicros} + ${deltas.costMicros}`,
        },
      });
  },

  /**
   * Atomically: lock the current-month sendseven usage row (creating if
   * missing) and increment sent_count (+ ai_sent_count when isAi). Phase 1
   * has no cap logic — it always consumes; caps are enforced at the service
   * layer in Phase 2. Uses raw SQL inside a real transaction so the SELECT
   * FOR UPDATE locking semantics are unambiguous — mirrors
   * `platformAdminCreditsRepository.consumeOneCredit`.
   */
  async consumeSendsevenMessage(
    orgId: string,
    periodStart: string,
    opts: { isAi: boolean },
  ): Promise<SendsevenConsumeResult> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO "sendseven_message_usage" (org_id, period_start, sent_count, ai_sent_count)
           VALUES ($1, $2, 0, 0)
         ON CONFLICT (org_id, period_start) DO NOTHING`,
        [orgId, periodStart],
      );

      const usageRes = await client.query<{
        id: string;
        sent_count: number;
        ai_sent_count: number;
      }>(
        `SELECT id, sent_count, ai_sent_count
           FROM "sendseven_message_usage"
          WHERE org_id = $1 AND period_start = $2
          FOR UPDATE`,
        [orgId, periodStart],
      );
      const usage = usageRes.rows[0];

      const newSentCount = usage.sent_count + 1;
      const newAiSentCount = usage.ai_sent_count + (opts.isAi ? 1 : 0);

      await client.query(
        `UPDATE "sendseven_message_usage"
            SET sent_count = $1, ai_sent_count = $2
          WHERE id = $3`,
        [newSentCount, newAiSentCount, usage.id],
      );

      await client.query("COMMIT");
      return { sentCount: newSentCount, aiSentCount: newAiSentCount };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  async getAiMonthly(orgId: string, periodStart: string): Promise<AiUsageMonthly | null> {
    const [row] = await db
      .select()
      .from(aiUsageMonthly)
      .where(and(eq(aiUsageMonthly.orgId, orgId), eq(aiUsageMonthly.periodStart, periodStart)))
      .limit(1);
    return row ?? null;
  },

  async getSendsevenMonthly(orgId: string, periodStart: string): Promise<SendsevenMessageUsage | null> {
    const [row] = await db
      .select()
      .from(sendsevenMessageUsage)
      .where(and(eq(sendsevenMessageUsage.orgId, orgId), eq(sendsevenMessageUsage.periodStart, periodStart)))
      .limit(1);
    return row ?? null;
  },

  async getLimits(orgId: string): Promise<OrgUsageLimits | null> {
    const [row] = await db
      .select()
      .from(orgUsageLimits)
      .where(eq(orgUsageLimits.orgId, orgId))
      .limit(1);
    return row ?? null;
  },

  async upsertLimits(orgId: string, patch: Partial<InsertOrgUsageLimits>): Promise<OrgUsageLimits> {
    const [row] = await db
      .insert(orgUsageLimits)
      .values({ orgId, ...patch })
      .onConflictDoUpdate({
        target: [orgUsageLimits.orgId],
        set: { ...patch, updatedAt: new Date() },
      })
      .returning();
    return row;
  },

  /** Most recent pricing row for `model` with `effective_from` <= now. */
  async getLatestPricing(model: string, now: Date = new Date()): Promise<ModelPricing | null> {
    const [row] = await db
      .select()
      .from(modelPricing)
      .where(and(eq(modelPricing.model, model), lte(modelPricing.effectiveFrom, now)))
      .orderBy(desc(modelPricing.effectiveFrom))
      .limit(1);
    return row ?? null;
  },

  async getOrgHistory(
    orgId: string,
    months: number,
  ): Promise<{ ai: AiUsageMonthly[]; sendseven: SendsevenMessageUsage[] }> {
    const [ai, sendseven] = await Promise.all([
      db
        .select()
        .from(aiUsageMonthly)
        .where(eq(aiUsageMonthly.orgId, orgId))
        .orderBy(desc(aiUsageMonthly.periodStart))
        .limit(months),
      db
        .select()
        .from(sendsevenMessageUsage)
        .where(eq(sendsevenMessageUsage.orgId, orgId))
        .orderBy(desc(sendsevenMessageUsage.periodStart))
        .limit(months),
    ]);
    return { ai, sendseven };
  },
};
