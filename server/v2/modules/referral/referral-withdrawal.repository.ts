import { db } from '../../config/database';
import { referral_withdrawal, clientTable, referral, booking } from '@shared/schema';
import type { InsertReferralWithdrawal, ReferralWithdrawal } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

export const referralWithdrawalRepository = {
  async create(data: InsertReferralWithdrawal): Promise<ReferralWithdrawal> {
    const [result] = await db.insert(referral_withdrawal).values(data).returning();
    return result;
  },

  async findById(id: string): Promise<ReferralWithdrawal | undefined> {
    const [result] = await db
      .select()
      .from(referral_withdrawal)
      .where(eq(referral_withdrawal.id, id))
      .limit(1);
    return result;
  },

  async findByIdWithOrg(id: string) {
    const [result] = await db
      .select({
        id: referral_withdrawal.id,
        referral_id: referral_withdrawal.referral_id,
        client_id: referral_withdrawal.client_id,
        status: referral_withdrawal.status,
        method: referral_withdrawal.method,
        clientOrgId: clientTable.orgId,
      })
      .from(referral_withdrawal)
      .leftJoin(clientTable, eq(referral_withdrawal.client_id, clientTable.id))
      .where(eq(referral_withdrawal.id, id))
      .limit(1);
    return result ?? null;
  },

  async findByIdWithDetails(id: string) {
    const [result] = await db
      .select({
        id: referral_withdrawal.id,
        referral_id: referral_withdrawal.referral_id,
        client_id: referral_withdrawal.client_id,
        amount: referral_withdrawal.amount,
        method: referral_withdrawal.method,
        status: referral_withdrawal.status,
        account_name: referral_withdrawal.account_name,
        account_number: referral_withdrawal.account_number,
        sort_code: referral_withdrawal.sort_code,
        transfer_reference: referral_withdrawal.transfer_reference,
        booking_id: referral_withdrawal.booking_id,
        credit_note: referral_withdrawal.credit_note,
        notes: referral_withdrawal.notes,
        requested_at: referral_withdrawal.requested_at,
        processed_at: referral_withdrawal.processed_at,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientEmail: clientTable.email,
        clientPhone: clientTable.phoneNumber,
        referredName: referral.referredName,
        referredEmail: referral.referredEmail,
        travelDate: referral.travelDate,
        bookingHaysRef: booking.hays_ref,
        bookingSupplierRef: booking.supplier_ref,
      })
      .from(referral_withdrawal)
      .leftJoin(clientTable, eq(referral_withdrawal.client_id, clientTable.id))
      .leftJoin(referral, eq(referral_withdrawal.referral_id, referral.id))
      .leftJoin(booking, eq(referral_withdrawal.booking_id, booking.id))
      .where(eq(referral_withdrawal.id, id))
      .limit(1);
    return result;
  },

  async findByReferralId(referralId: string): Promise<ReferralWithdrawal | undefined> {
    const [result] = await db
      .select()
      .from(referral_withdrawal)
      .where(eq(referral_withdrawal.referral_id, referralId))
      .limit(1);
    return result;
  },

  async findByClientId(clientId: string): Promise<ReferralWithdrawal[]> {
    return db
      .select()
      .from(referral_withdrawal)
      .where(eq(referral_withdrawal.client_id, clientId))
      .orderBy(referral_withdrawal.requested_at);
  },

  async findAll(orgId: string | null) {
    const baseQuery = db
      .select({
        id: referral_withdrawal.id,
        referral_id: referral_withdrawal.referral_id,
        client_id: referral_withdrawal.client_id,
        amount: referral_withdrawal.amount,
        method: referral_withdrawal.method,
        status: referral_withdrawal.status,
        account_name: referral_withdrawal.account_name,
        account_number: referral_withdrawal.account_number,
        sort_code: referral_withdrawal.sort_code,
        transfer_reference: referral_withdrawal.transfer_reference,
        booking_id: referral_withdrawal.booking_id,
        credit_note: referral_withdrawal.credit_note,
        notes: referral_withdrawal.notes,
        invoice_url: referral_withdrawal.invoice_url,
        requested_at: referral_withdrawal.requested_at,
        processed_at: referral_withdrawal.processed_at,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientEmail: clientTable.email,
        clientPhone: clientTable.phoneNumber,
        referredName: referral.referredName,
        referredEmail: referral.referredEmail,
        travelDate: referral.travelDate,
        referralStatus: referral.referralStatus,
        bookingHaysRef: booking.hays_ref,
        bookingSupplierRef: booking.supplier_ref,
      })
      .from(referral_withdrawal)
      .leftJoin(clientTable, eq(referral_withdrawal.client_id, clientTable.id))
      .leftJoin(referral, eq(referral_withdrawal.referral_id, referral.id))
      .leftJoin(booking, eq(referral_withdrawal.booking_id, booking.id));

    const scoped = orgId
      ? baseQuery.where(eq(clientTable.orgId, orgId))
      : baseQuery;

    return scoped.orderBy(referral_withdrawal.requested_at);
  },

  async markProcessed(
    id: string,
    data: {
      transfer_reference?: string;
      booking_id?: string;
      credit_note?: string;
      notes?: string;
      invoice_url?: string;
    },
  ): Promise<ReferralWithdrawal> {
    const [result] = await db
      .update(referral_withdrawal)
      .set({
        status: 'processed',
        processed_at: new Date(),
        ...(data.transfer_reference ? { transfer_reference: data.transfer_reference } : {}),
        ...(data.booking_id ? { booking_id: data.booking_id } : {}),
        ...(data.credit_note ? { credit_note: data.credit_note } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
        ...(data.invoice_url ? { invoice_url: data.invoice_url } : {}),
      })
      .where(eq(referral_withdrawal.id, id))
      .returning();
    return result;
  },

  async markRejected(id: string, notes?: string): Promise<ReferralWithdrawal> {
    const [result] = await db
      .update(referral_withdrawal)
      .set({ status: 'rejected', ...(notes ? { notes } : {}) })
      .where(eq(referral_withdrawal.id, id))
      .returning();
    return result;
  },

  async sumProcessedByClientId(clientId: string): Promise<number> {
    const rows = await db
      .select({ amount: referral_withdrawal.amount })
      .from(referral_withdrawal)
      .where(
        and(eq(referral_withdrawal.client_id, clientId), eq(referral_withdrawal.status, 'processed')),
      );
    return rows.reduce((sum, r) => sum + parseFloat(r.amount ?? '0'), 0);
  },
};
