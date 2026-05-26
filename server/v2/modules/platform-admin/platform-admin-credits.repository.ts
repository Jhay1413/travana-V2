import { db, pool } from '../../config/database';
import {
  organization,
  smsCreditUsage,
  smsCreditCharge,
  type SmsCreditUsage,
  type SmsCreditCharge,
} from '@shared/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

export interface OrgCreditConfig {
  monthlySmsCreditLimit: number;
  smsOveragePriceCents:  number;
  smsCreditsEnabled:     boolean;
}

export interface ChargeFilters {
  status?: 'pending' | 'invoiced' | 'paid' | 'written_off';
  limit:   number;
  offset:  number;
}

export interface ConsumptionRecord {
  enabled: boolean;
  overage: boolean;
  chargeId: string | null;
}

/** First-of-month date in UTC as a YYYY-MM-DD string. */
export function startOfMonthUtc(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export const platformAdminCreditsRepository = {
  async findOrgCreditConfig(orgId: string): Promise<OrgCreditConfig | null> {
    const [row] = await db
      .select({
        monthlySmsCreditLimit: organization.monthlySmsCreditLimit,
        smsOveragePriceCents:  organization.smsOveragePriceCents,
        smsCreditsEnabled:     organization.smsCreditsEnabled,
      })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    return row ?? null;
  },

  async setMonthlyLimit(orgId: string, limit: number, enabled?: boolean): Promise<void> {
    const patch: { monthlySmsCreditLimit: number; smsCreditsEnabled?: boolean } = {
      monthlySmsCreditLimit: limit,
    };
    if (enabled !== undefined) patch.smsCreditsEnabled = enabled;
    await db.update(organization).set(patch).where(eq(organization.id, orgId));
  },

  async setOveragePriceCents(orgId: string, cents: number): Promise<void> {
    await db
      .update(organization)
      .set({ smsOveragePriceCents: cents })
      .where(eq(organization.id, orgId));
  },

  async findCurrentUsage(orgId: string, periodStart: string): Promise<SmsCreditUsage | null> {
    const [row] = await db
      .select()
      .from(smsCreditUsage)
      .where(and(eq(smsCreditUsage.orgId, orgId), eq(smsCreditUsage.periodStart, periodStart)))
      .limit(1);
    return row ?? null;
  },

  async findUsageByOrg(orgId: string, months: number): Promise<SmsCreditUsage[]> {
    return db
      .select()
      .from(smsCreditUsage)
      .where(eq(smsCreditUsage.orgId, orgId))
      .orderBy(desc(smsCreditUsage.periodStart))
      .limit(months);
  },

  async addGrantedCredits(orgId: string, periodStart: string, credits: number): Promise<void> {
    // Upsert the usage row, then add `credits` to the granted column.
    await db
      .insert(smsCreditUsage)
      .values({ orgId, periodStart, creditsUsed: 0, creditsGranted: credits })
      .onConflictDoUpdate({
        target: [smsCreditUsage.orgId, smsCreditUsage.periodStart],
        set: {
          creditsGranted: sql`${smsCreditUsage.creditsGranted} + ${credits}`,
          updatedAt:      new Date(),
        },
      });
  },

  async findChargesByOrg(orgId: string, filters: ChargeFilters): Promise<SmsCreditCharge[]> {
    const conds = [
      eq(smsCreditCharge.orgId, orgId),
      filters.status ? eq(smsCreditCharge.status, filters.status) : undefined,
    ].filter((x): x is NonNullable<typeof x> => x !== undefined);

    return db
      .select()
      .from(smsCreditCharge)
      .where(and(...conds))
      .orderBy(desc(smsCreditCharge.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);
  },

  async findChargeById(orgId: string, chargeId: string): Promise<SmsCreditCharge | null> {
    const [row] = await db
      .select()
      .from(smsCreditCharge)
      .where(and(eq(smsCreditCharge.id, chargeId), eq(smsCreditCharge.orgId, orgId)))
      .limit(1);
    return row ?? null;
  },

  async markWrittenOff(orgId: string, chargeId: string): Promise<void> {
    await db
      .update(smsCreditCharge)
      .set({ status: 'written_off' })
      .where(and(eq(smsCreditCharge.id, chargeId), eq(smsCreditCharge.orgId, orgId)));
  },

  async sumPendingCharges(orgId: string): Promise<number> {
    const [row] = await db
      .select({
        total: sql<number>`COALESCE(SUM("amount_cents"), 0)::int`,
      })
      .from(smsCreditCharge)
      .where(and(eq(smsCreditCharge.orgId, orgId), eq(smsCreditCharge.status, 'pending')));
    return row?.total ?? 0;
  },

  /**
   * Atomically: lock the current-month usage row (creating if missing),
   * increment creditsUsed by 1, and create a pending overage charge if the
   * new count exceeds (limit + granted). Pricing is snapshotted from
   * `organization.smsOveragePriceCents` at the moment of consumption.
   *
   * Uses raw SQL so the SELECT FOR UPDATE happens inside a real transaction
   * and the locking semantics are unambiguous. The caller is responsible for
   * skipping this call entirely when sms_credits_enabled is false.
   */
  async consumeOneCredit(orgId: string, periodStart: string): Promise<ConsumptionRecord> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch the org's credit config inside the transaction so we snapshot
      // the price at consumption time even if it changes mid-flight.
      const orgRes = await client.query<{
        monthly_sms_credit_limit: number;
        sms_overage_price_cents: number;
        sms_credits_enabled: boolean;
      }>(
        `SELECT monthly_sms_credit_limit, sms_overage_price_cents, sms_credits_enabled
           FROM "organization" WHERE id = $1`,
        [orgId],
      );
      const cfg = orgRes.rows[0];
      if (!cfg) {
        await client.query('ROLLBACK');
        return { enabled: false, overage: false, chargeId: null };
      }
      if (!cfg.sms_credits_enabled) {
        await client.query('ROLLBACK');
        return { enabled: false, overage: false, chargeId: null };
      }

      // Upsert the usage row, then lock it.
      await client.query(
        `INSERT INTO "sms_credit_usage" (org_id, period_start, credits_used, credits_granted)
           VALUES ($1, $2, 0, 0)
         ON CONFLICT (org_id, period_start) DO NOTHING`,
        [orgId, periodStart],
      );

      const usageRes = await client.query<{
        id: string;
        credits_used: number;
        credits_granted: number;
      }>(
        `SELECT id, credits_used, credits_granted
           FROM "sms_credit_usage"
          WHERE org_id = $1 AND period_start = $2
          FOR UPDATE`,
        [orgId, periodStart],
      );
      const usage = usageRes.rows[0];

      const newUsed   = usage.credits_used + 1;
      const allowance = cfg.monthly_sms_credit_limit + usage.credits_granted;
      const overage   = newUsed > allowance;

      await client.query(
        `UPDATE "sms_credit_usage"
            SET credits_used = $1, updated_at = NOW()
          WHERE id = $2`,
        [newUsed, usage.id],
      );

      let chargeId: string | null = null;
      if (overage) {
        const chargeRes = await client.query<{ id: string }>(
          `INSERT INTO "sms_credit_charge"
             (org_id, period_start, credits, unit_price_cents, amount_cents, status)
           VALUES ($1, $2, 1, $3, $3, 'pending')
           RETURNING id`,
          [orgId, periodStart, cfg.sms_overage_price_cents],
        );
        chargeId = chargeRes.rows[0]?.id ?? null;
      }

      await client.query('COMMIT');
      return { enabled: true, overage, chargeId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async attachMessageToCharge(chargeId: string, smsMessageId: string): Promise<void> {
    await db
      .update(smsCreditCharge)
      .set({ smsMessageId })
      .where(eq(smsCreditCharge.id, chargeId));
  },
};
