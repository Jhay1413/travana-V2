import { db } from "../config/database";
import { wallet_transaction, clientTable, referral, booking } from "@shared/schema";
import type { InsertWalletTransaction, WalletTransaction } from "@shared/schema";
import { and, eq, ne, sql } from "drizzle-orm";

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

  async findByClientId(clientId: string): Promise<WalletTransaction[]> {
    return db
      .select()
      .from(wallet_transaction)
      .where(eq(wallet_transaction.client_id, clientId))
      .orderBy(wallet_transaction.created_at);
  },

  // Available balance = sum of processed credits − sum of non-rejected debits
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

  async findAll() {
    return db
      .select({
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
        status: wallet_transaction.status,
        created_at: wallet_transaction.created_at,
        processed_at: wallet_transaction.processed_at,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientEmail: clientTable.email,
        bookingRef: booking.hays_ref,
      })
      .from(wallet_transaction)
      .leftJoin(clientTable, eq(wallet_transaction.client_id, clientTable.id))
      .leftJoin(booking, eq(wallet_transaction.booking_id, booking.id))
      .orderBy(wallet_transaction.created_at);
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
