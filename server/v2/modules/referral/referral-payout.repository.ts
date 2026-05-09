import { db } from '../../config/database';
import { referral_payout, clientTable, referral } from '@shared/schema';
import type { InsertReferralPayout, ReferralPayout } from '@shared/schema';
import { eq } from 'drizzle-orm';

export const referralPayoutRepository = {
  async create(data: InsertReferralPayout): Promise<ReferralPayout> {
    const [result] = await db.insert(referral_payout).values(data).returning();
    return result;
  },

  async findById(id: string): Promise<ReferralPayout | undefined> {
    const [result] = await db
      .select()
      .from(referral_payout)
      .where(eq(referral_payout.id, id))
      .limit(1);
    return result;
  },

  async findByReferralId(referralId: string): Promise<ReferralPayout | undefined> {
    const [result] = await db
      .select()
      .from(referral_payout)
      .where(eq(referral_payout.referral_id, referralId))
      .limit(1);
    return result;
  },

  async findByClientId(clientId: string): Promise<ReferralPayout[]> {
    return db
      .select()
      .from(referral_payout)
      .where(eq(referral_payout.client_id, clientId))
      .orderBy(referral_payout.requested_at);
  },

  async findAll() {
    return db
      .select({
        id: referral_payout.id,
        referral_id: referral_payout.referral_id,
        client_id: referral_payout.client_id,
        amount: referral_payout.amount,
        status: referral_payout.status,
        notes: referral_payout.notes,
        requested_at: referral_payout.requested_at,
        approved_at: referral_payout.approved_at,
        rejected_at: referral_payout.rejected_at,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientEmail: clientTable.email,
        clientPhone: clientTable.phoneNumber,
        referredName: referral.referredName,
        referredEmail: referral.referredEmail,
        travelDate: referral.travelDate,
        referralStatus: referral.referralStatus,
      })
      .from(referral_payout)
      .leftJoin(clientTable, eq(referral_payout.client_id, clientTable.id))
      .leftJoin(referral, eq(referral_payout.referral_id, referral.id))
      .orderBy(referral_payout.requested_at);
  },

  async markApproved(id: string, notes?: string): Promise<ReferralPayout> {
    const [result] = await db
      .update(referral_payout)
      .set({ status: 'approved', approved_at: new Date(), ...(notes ? { notes } : {}) })
      .where(eq(referral_payout.id, id))
      .returning();
    return result;
  },

  async markRejected(id: string, notes?: string): Promise<ReferralPayout> {
    const [result] = await db
      .update(referral_payout)
      .set({ status: 'rejected', rejected_at: new Date(), ...(notes ? { notes } : {}) })
      .where(eq(referral_payout.id, id))
      .returning();
    return result;
  },
};
