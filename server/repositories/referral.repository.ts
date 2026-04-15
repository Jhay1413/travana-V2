import { db } from "../config/database";
import { referral, clientTable, booking } from "@shared/schema";
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

    // Client VIP profile
    const [clientRow] = await db
      .select({
        vipTier: clientTable.vipTier,
        vipEnrolledAt: clientTable.vipEnrolledAt,
        totalReferrals: clientTable.totalReferrals,
      })
      .from(clientTable)
      .where(eq(clientTable.id, referrerClientId));

    // Clients referred by this client (from clientTable.referredByClientId)
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

    // Stats from referral table
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

    // Transaction history: referral rows joined with booking via transactionId
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
      .where(and(eq(referral.referrerClientId, referrerClientId), sql`${referral.transactionId} IS NOT NULL`))
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
      },
      referredClients,
      transactionHistory,
    };
  },
};
