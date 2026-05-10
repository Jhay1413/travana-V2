import { db } from "../../config/database";
import { wallet_transaction, clientTable, booking } from "@shared/schema";
import type { InsertWalletTransaction, WalletTransaction } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

export const walletTransactionRepository = {
  async create(data: InsertWalletTransaction): Promise<WalletTransaction> {
    const [result] = await db.insert(wallet_transaction).values(data).returning();
    return result;
  },

  async findById(id: string): Promise<WalletTransaction | undefined> {
    const [result] = await db
      .select()
      .from(wallet_transaction)
      .where(eq(wallet_transaction.id, id))
      .limit(1);
    return result;
  },

  async findByIdWithOrg(id: string) {
    const [result] = await db
      .select({
        id: wallet_transaction.id,
        client_id: wallet_transaction.client_id,
        type: wallet_transaction.type,
        status: wallet_transaction.status,
        amount: wallet_transaction.amount,
        clientOrgId: clientTable.orgId,
      })
      .from(wallet_transaction)
      .leftJoin(clientTable, eq(wallet_transaction.client_id, clientTable.id))
      .where(eq(wallet_transaction.id, id))
      .limit(1);
    return result ?? null;
  },

  async clientBelongsToOrg(clientId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: clientTable.id })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async findByClientId(clientId: string): Promise<WalletTransaction[]> {
    return db
      .select()
      .from(wallet_transaction)
      .where(eq(wallet_transaction.client_id, clientId))
      .orderBy(wallet_transaction.created_at);
  },

  async getBalance(clientId: string): Promise<number> {
    const [row] = await db
      .select({
        balance: sql<string>`
          COALESCE(SUM(
            CASE WHEN ${wallet_transaction.type} = 'credit' AND ${wallet_transaction.status} = 'processed'
            THEN ${wallet_transaction.amount}::numeric ELSE 0 END
          ), 0)
          -
          COALESCE(SUM(
            CASE WHEN ${wallet_transaction.type} = 'debit' AND ${wallet_transaction.status} != 'rejected'
            THEN ${wallet_transaction.amount}::numeric ELSE 0 END
          ), 0)
        `,
      })
      .from(wallet_transaction)
      .where(eq(wallet_transaction.client_id, clientId));
    return parseFloat(row?.balance ?? "0");
  },

  async findAll(orgId: string | null) {
    const baseSelect = {
      id: wallet_transaction.id,
      client_id: wallet_transaction.client_id,
      type: wallet_transaction.type,
      amount: wallet_transaction.amount,
      source: wallet_transaction.source,
      referral_id: wallet_transaction.referral_id,
      booking_id: wallet_transaction.booking_id,
      account_name: wallet_transaction.account_name,
      transfer_reference: wallet_transaction.transfer_reference,
      notes: wallet_transaction.notes,
      invoice_url: wallet_transaction.invoice_url,
      status: wallet_transaction.status,
      created_at: wallet_transaction.created_at,
      processed_at: wallet_transaction.processed_at,
      clientFirstName: clientTable.firstName,
      clientSurname: clientTable.surename,
      clientEmail: clientTable.email,
      bookingRef: booking.hays_ref,
    };

    const query = db
      .select(baseSelect)
      .from(wallet_transaction)
      .leftJoin(clientTable, eq(wallet_transaction.client_id, clientTable.id))
      .leftJoin(booking, eq(wallet_transaction.booking_id, booking.id));

    const scoped = orgId
      ? query.where(eq(clientTable.orgId, orgId))
      : query;

    return scoped.orderBy(wallet_transaction.created_at);
  },

  async findByIdWithDetails(id: string) {
    const [result] = await db
      .select({
        id: wallet_transaction.id,
        client_id: wallet_transaction.client_id,
        type: wallet_transaction.type,
        amount: wallet_transaction.amount,
        source: wallet_transaction.source,
        booking_id: wallet_transaction.booking_id,
        transfer_reference: wallet_transaction.transfer_reference,
        notes: wallet_transaction.notes,
        invoice_url: wallet_transaction.invoice_url,
        status: wallet_transaction.status,
        created_at: wallet_transaction.created_at,
        processed_at: wallet_transaction.processed_at,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientEmail: clientTable.email,
        clientPhone: clientTable.phoneNumber,
        bookingHaysRef: booking.hays_ref,
        bookingSupplierRef: booking.supplier_ref,
        bookingTravelDate: booking.travel_date,
      })
      .from(wallet_transaction)
      .leftJoin(clientTable, eq(wallet_transaction.client_id, clientTable.id))
      .leftJoin(booking, eq(wallet_transaction.booking_id, booking.id))
      .where(eq(wallet_transaction.id, id))
      .limit(1);
    return result;
  },

  async update(id: string, data: Partial<WalletTransaction>): Promise<WalletTransaction> {
    const [result] = await db
      .update(wallet_transaction)
      .set(data)
      .where(eq(wallet_transaction.id, id))
      .returning();
    return result;
  },

  async findPendingDebitByBookingId(bookingId: string): Promise<WalletTransaction | undefined> {
    const [result] = await db
      .select()
      .from(wallet_transaction)
      .where(
        and(
          eq(wallet_transaction.booking_id, bookingId),
          eq(wallet_transaction.type, "debit"),
          eq(wallet_transaction.source, "booking_credit"),
          eq(wallet_transaction.status, "pending"),
        )
      )
      .limit(1);
    return result;
  },
};
