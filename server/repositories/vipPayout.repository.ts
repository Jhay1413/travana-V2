import { db } from "../config/database";
import { vip_payout, clientTable, referral } from "@shared/schema";
import type { InsertVipPayout, VipPayout } from "@shared/schema";
import { eq } from "drizzle-orm";

export const vipPayoutRepository = {
  async create(data: InsertVipPayout): Promise<VipPayout> {
    const [result] = await db.insert(vip_payout).values(data).returning();
    return result;
  },

  async findById(id: string): Promise<VipPayout | undefined> {
    const [result] = await db.select().from(vip_payout).where(eq(vip_payout.id, id)).limit(1);
    return result;
  },

  async findAll() {
    return db
      .select({
        id: vip_payout.id,
        referralId: vip_payout.referralId,
        clientId: vip_payout.clientId,
        amount: vip_payout.amount,
        method: vip_payout.method,
        status: vip_payout.status,
        notes: vip_payout.notes,
        processedAt: vip_payout.processedAt,
        createdAt: vip_payout.createdAt,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientEmail: clientTable.email,
        clientPhone: clientTable.phoneNumber,
        referredName: referral.referredName,
        referredEmail: referral.referredEmail,
        referredPhone: referral.referredPhone,
        referralStatus: referral.referralStatus,
        travelDate: referral.travelDate,
        transactionId: referral.transactionId,
      })
      .from(vip_payout)
      .leftJoin(clientTable, eq(vip_payout.clientId, clientTable.id))
      .leftJoin(referral, eq(vip_payout.referralId, referral.id))
      .orderBy(vip_payout.createdAt);
  },

  async findByClientId(clientId: string): Promise<VipPayout[]> {
    return db
      .select()
      .from(vip_payout)
      .where(eq(vip_payout.clientId, clientId))
      .orderBy(vip_payout.createdAt);
  },

  async findByReferralId(referralId: string): Promise<VipPayout[]> {
    return db
      .select()
      .from(vip_payout)
      .where(eq(vip_payout.referralId, referralId));
  },

  async markProcessed(id: string, notes?: string): Promise<VipPayout> {
    const [result] = await db
      .update(vip_payout)
      .set({
        status: "processed",
        processedAt: new Date(),
        ...(notes ? { notes } : {}),
      })
      .where(eq(vip_payout.id, id))
      .returning();
    return result;
  },

  async sumPaidByClientId(clientId: string): Promise<number> {
    const rows = await db
      .select({ amount: vip_payout.amount })
      .from(vip_payout)
      .where(eq(vip_payout.clientId, clientId));
    return rows.reduce((sum, r) => sum + parseFloat(r.amount ?? "0"), 0);
  },
};
