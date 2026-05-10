import { db } from "../../config/database";
import { referral, clientTable, booking, wallet_transaction } from "@shared/schema";
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

  async findByIdWithOrg(id: string) {
    const [result] = await db
      .select({
        id: referral.id,
        referrerClientId: referral.referrerClientId,
        referralStatus: referral.referralStatus,
        payoutAmount: referral.payoutAmount,
        referrerOrgId: referrerClient.orgId,
      })
      .from(referral)
      .leftJoin(referrerClient, eq(referral.referrerClientId, referrerClient.id))
      .where(eq(referral.id, id))
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

  async findAll(orgId: string | null) {
    const today = new Date().toISOString().split("T")[0];

    const baseQuery = db
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
      .leftJoin(referredClient, eq(referral.referredClientId, referredClient.id));

    const scoped = orgId
      ? baseQuery.where(eq(referrerClient.orgId, orgId))
      : baseQuery;

    const rows = await scoped.orderBy(referral.createdAt);

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

  async findDueForAutoApproval(referrerClientId?: string): Promise<Referral[]> {
    const today = new Date().toISOString().split("T")[0];
    if (referrerClientId) {
      return db.select().from(referral).where(
        and(
          eq(referral.referralStatus, "PENDING"),
          lte(referral.payoutTriggerDate, today),
          eq(referral.referrerClientId, referrerClientId)
        )
      );
    }
    return db.select().from(referral).where(
      and(
        eq(referral.referralStatus, "PENDING"),
        lte(referral.payoutTriggerDate, today)
      )
    );
  },

  async getStatsByReferrerId(referrerClientId: string): Promise<{
    total: number;
    pending: number;
    wallet: number;
    overall: number;
  }> {
    const [clientCountRow] = await db
      .select({ total: sql<string>`COUNT(*)` })
      .from(clientTable)
      .where(eq(clientTable.referredByClientId, referrerClientId));

    const [commRow] = await db
      .select({
        pending: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} = 'PENDING' THEN CAST(COALESCE(${referral.commission}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        wallet: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} = 'IN_WALLET' THEN CAST(COALESCE(${referral.commission}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        overall: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} != 'VOIDED' THEN CAST(COALESCE(${referral.commission}, '0') AS DECIMAL) ELSE 0 END), 0)`,
      })
      .from(referral)
      .where(eq(referral.referrerClientId, referrerClientId));

    return {
      total: parseInt(clientCountRow?.total ?? "0", 10),
      pending: parseFloat(commRow?.pending ?? "0"),
      wallet: parseFloat(commRow?.wallet ?? "0"),
      overall: parseFloat(commRow?.overall ?? "0"),
    };
  },

  async getVipOverview(referrerClientId: string) {
    const today = new Date().toISOString().split("T")[0];

    const [clientRow] = await db
      .select({
        vipTier: clientTable.vipTier,
        vipEnrolledAt: clientTable.vipEnrolledAt,
        totalReferrals: clientTable.totalReferrals,
      })
      .from(clientTable)
      .where(eq(clientTable.id, referrerClientId));

    const referredClients = await db
      .select({
        id: clientTable.id,
        firstName: clientTable.firstName,
        surename: clientTable.surename,
        email: clientTable.email,
        phoneNumber: clientTable.phoneNumber,
        createdAt: clientTable.createdAt,
      })
      .from(clientTable)
      .where(eq(clientTable.referredByClientId, referrerClientId));

    const [statsRow] = await db
      .select({
        pendingCount: sql<string>`COUNT(*) FILTER (WHERE ${referral.referralStatus} = 'PENDING')`,
        inWalletCount: sql<string>`COUNT(*) FILTER (WHERE ${referral.referralStatus} = 'IN_WALLET')`,
        paidCount: sql<string>`COUNT(*) FILTER (WHERE ${referral.referralStatus} = 'PAID')`,
        voidedCount: sql<string>`COUNT(*) FILTER (WHERE ${referral.referralStatus} = 'VOIDED')`,
        pendingCommission: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} = 'PENDING' THEN CAST(COALESCE(${referral.commission}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        walletCommission: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} = 'IN_WALLET' THEN CAST(COALESCE(${referral.commission}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        paidCommission: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} = 'PAID' THEN CAST(COALESCE(${referral.commission}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        overallCommission: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} != 'VOIDED' THEN CAST(COALESCE(${referral.commission}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        pendingPayout: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} = 'PENDING' THEN CAST(COALESCE(${referral.payoutAmount}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        walletPayout: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} = 'IN_WALLET' THEN CAST(COALESCE(${referral.payoutAmount}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        paidPayout: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} = 'PAID' THEN CAST(COALESCE(${referral.payoutAmount}, '0') AS DECIMAL) ELSE 0 END), 0)`,
        overallPayout: sql<string>`COALESCE(SUM(CASE WHEN ${referral.referralStatus} != 'VOIDED' THEN CAST(COALESCE(${referral.payoutAmount}, '0') AS DECIMAL) ELSE 0 END), 0)`,
      })
      .from(referral)
      .where(eq(referral.referrerClientId, referrerClientId));

    const [walletRow] = await db
      .select({
        debitTotal: sql<string>`
          COALESCE(SUM(
            CASE WHEN ${wallet_transaction.type} = 'debit' AND ${wallet_transaction.status} != 'rejected'
            THEN ${wallet_transaction.amount}::numeric ELSE 0 END
          ), 0)
        `,
      })
      .from(wallet_transaction)
      .where(eq(wallet_transaction.client_id, referrerClientId));

    const walletReferral = alias(referral, "wallet_referral");
    const walletBooking = alias(booking, "wallet_booking");

    const walletLedger = await db
      .select({
        id: wallet_transaction.id,
        type: wallet_transaction.type,
        source: wallet_transaction.source,
        amount: wallet_transaction.amount,
        status: wallet_transaction.status,
        referral_id: wallet_transaction.referral_id,
        booking_id: wallet_transaction.booking_id,
        referral_referred_name: walletReferral.referredName,
        booking_hays_ref: walletBooking.hays_ref,
        notes: wallet_transaction.notes,
        created_at: wallet_transaction.created_at,
        processed_at: wallet_transaction.processed_at,
      })
      .from(wallet_transaction)
      .leftJoin(walletReferral, eq(wallet_transaction.referral_id, walletReferral.id))
      .leftJoin(walletBooking, eq(wallet_transaction.booking_id, walletBooking.id))
      .where(eq(wallet_transaction.client_id, referrerClientId))
      .orderBy(wallet_transaction.created_at);

    const bookingAlias = alias(booking, "ref_booking");
    const txRows = await db
      .select({
        id: referral.id,
        referralStatus: referral.referralStatus,
        referredName: referral.referredName,
        referredClientId: referral.referredClientId,
        referredClientFirstName: referredClient.firstName,
        referredClientSurname: referredClient.surename,
        commission: referral.commission,
        payoutAmount: referral.payoutAmount,
        travelDate: referral.travelDate,
        payoutTriggerDate: referral.payoutTriggerDate,
        paidAt: referral.paidAt,
        createdAt: referral.createdAt,
        transactionId: referral.transactionId,
        bookingTitle: bookingAlias.title,
        bookingTravelDate: bookingAlias.travel_date,
        bookingSalesPrice: bookingAlias.sales_price,
        bookingCommission: bookingAlias.package_commission,
        bookingStatus: bookingAlias.booking_status,
        bookingHaysRef: bookingAlias.hays_ref,
      })
      .from(referral)
      .leftJoin(referredClient, eq(referral.referredClientId, referredClient.id))
      .leftJoin(bookingAlias, eq(bookingAlias.transaction_id, referral.transactionId))
      .where(eq(referral.referrerClientId, referrerClientId))
      .orderBy(referral.createdAt);

    const transactionHistory = txRows.map((r) => ({
      ...r,
      isDue:
        r.referralStatus === "PENDING" &&
        r.payoutTriggerDate !== null &&
        r.payoutTriggerDate <= today,
    }));

    return {
      vipTier: clientRow?.vipTier ?? null,
      vipEnrolledAt: clientRow?.vipEnrolledAt ?? null,
      dbTotalReferrals: clientRow?.totalReferrals ?? 0,
      stats: {
        total: referredClients.length,
        pendingCount: parseInt(statsRow?.pendingCount ?? "0", 10),
        inWalletCount: parseInt(statsRow?.inWalletCount ?? "0", 10),
        paidCount: parseInt(statsRow?.paidCount ?? "0", 10),
        voidedCount: parseInt(statsRow?.voidedCount ?? "0", 10),
        pendingCommission: parseFloat(statsRow?.pendingCommission ?? "0"),
        walletCommission: parseFloat(statsRow?.walletCommission ?? "0"),
        paidCommission: parseFloat(statsRow?.paidCommission ?? "0"),
        overallCommission: parseFloat(statsRow?.overallCommission ?? "0"),
        pendingPayout: parseFloat(statsRow?.pendingPayout ?? "0"),
        walletPayout: parseFloat(statsRow?.walletPayout ?? "0"),
        paidPayout: parseFloat(statsRow?.paidPayout ?? "0"),
        overallPayout: parseFloat(statsRow?.overallPayout ?? "0"),
        availableBalance: Math.max(0, parseFloat(statsRow?.walletPayout ?? "0") - parseFloat(walletRow?.debitTotal ?? "0")),
      },
      referredClients,
      transactionHistory,
      walletLedger,
    };
  },
};
