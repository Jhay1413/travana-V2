import { db } from "../config/database";
import { referral, clientTable } from "@shared/schema";
import type { InsertReferral, Referral } from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const referrerClient = alias(clientTable, "referrer_client");
const referredClient = alias(clientTable, "referred_client");

export const referralRepository = {
  async create(data: InsertReferral): Promise<Referral> {
    const [result] = await db.insert(referral).values(data).returning();
    return result;
  },

  async findById(id: string): Promise<Referral | undefined> {
    const [result] = await db.select().from(referral).where(eq(referral.id, id)).limit(1);
    return result;
  },

  async findAll() {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db
      .select({
        id: referral.id,
        referralStatus: referral.referralStatus,
        referredName: referral.referredName,
        referredEmail: referral.referredEmail,
        referredPhone: referral.referredPhone,
        travelDate: referral.travelDate,
        payoutTriggerDate: referral.payoutTriggerDate,
        payoutAmount: referral.payoutAmount,
        commission: referral.commission,
        paidAt: referral.paidAt,
        createdAt: referral.createdAt,
        updatedAt: referral.updatedAt,
        referrerClientId: referral.referrerClientId,
        referredClientId: referral.referredClientId,
        transactionId: referral.transactionId,
        referrerFirstName: referrerClient.firstName,
        referrerSurname: referrerClient.surename,
        referrerEmail: referrerClient.email,
        referredFirstName: referredClient.firstName,
        referredSurname: referredClient.surename,
      })
      .from(referral)
      .leftJoin(referrerClient, eq(referral.referrerClientId, referrerClient.id))
      .leftJoin(referredClient, eq(referral.referredClientId, referredClient.id))
      .orderBy(referral.createdAt);

    return rows.map((r) => ({
      ...r,
      isDue:
        r.referralStatus === "PENDING" &&
        r.payoutTriggerDate !== null &&
        r.payoutTriggerDate <= today,
    }));
  },

  async findByReferrerClientId(referrerClientId: string) {
    const today = new Date().toISOString().split("T")[0];
    const rows = await db
      .select()
      .from(referral)
      .where(eq(referral.referrerClientId, referrerClientId))
      .orderBy(referral.createdAt);

    return rows.map((r) => ({
      ...r,
      isDue:
        r.referralStatus === "PENDING" &&
        r.payoutTriggerDate !== null &&
        r.payoutTriggerDate <= today,
    }));
  },

  async findByTransactionId(transactionId: string): Promise<Referral | undefined> {
    const [result] = await db
      .select()
      .from(referral)
      .where(eq(referral.transactionId, transactionId))
      .limit(1);
    return result;
  },

  async updateStatus(
    id: string,
    status: "PENDING" | "IN_WALLET" | "PAID" | "VOIDED"
  ): Promise<Referral> {
    const [result] = await db
      .update(referral)
      .set({
        referralStatus: status,
        updatedAt: new Date(),
        ...(status === "PAID" ? { paidAt: new Date() } : {}),
      })
      .where(eq(referral.id, id))
      .returning();
    return result;
  },

  async linkReferredClient(id: string, referredClientId: string): Promise<Referral> {
    const [result] = await db
      .update(referral)
      .set({ referredClientId, updatedAt: new Date() })
      .where(eq(referral.id, id))
      .returning();
    return result;
  },

  async voidByTransactionId(transactionId: string): Promise<void> {
    await db
      .update(referral)
      .set({ referralStatus: "VOIDED", updatedAt: new Date() })
      .where(
        and(
          eq(referral.transactionId, transactionId),
          sql`${referral.referralStatus} != 'PAID'`
        )
      );
  },

  async countSuccessfulByReferrer(referrerClientId: string): Promise<number> {
    const rows = await db
      .select({ id: referral.id })
      .from(referral)
      .where(
        and(
          eq(referral.referrerClientId, referrerClientId),
          sql`${referral.referralStatus} IN ('IN_WALLET', 'PAID')`
        )
      );
    return rows.length;
  },

  async update(id: string, data: Partial<InsertReferral>): Promise<Referral> {
    const [result] = await db
      .update(referral)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(referral.id, id))
      .returning();
    return result;
  },

  async delete(id: string): Promise<void> {
    await db.delete(referral).where(eq(referral.id, id));
  },
};
