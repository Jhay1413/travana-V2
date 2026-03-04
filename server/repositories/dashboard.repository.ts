import { db } from "../config/database";
import { clientTable, transaction, quote, booking } from "@shared/schema";
import { sql, eq, and, gte, lte } from "drizzle-orm";

export const dashboardRepository = {
  async getStats(): Promise<{
    totalClients: number;
    totalQuotes: number;
    totalRevenue: number;
    avgDealSize: number;
    totalTransactions: number;
    enquiryCount: number;
    quotedCount: number;
    bookedCount: number;
  }> {
    const [clientCount, transactionStats, quoteStats, revenueStats] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clientTable),
      db.select({
        total: sql<number>`count(*)`,
        enquiry: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_enquiry')`,
        quoted: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_quote')`,
        booked: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_booking')`,
      }).from(transaction),
      db.select({
        total: sql<number>`count(*)`,
      }).from(quote),
      db.select({
        total: sql<number>`COALESCE(SUM(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
        avg: sql<number>`COALESCE(AVG(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
      }).from(quote),
    ]);

    return {
      totalClients: Number(clientCount[0].count),
      totalQuotes: Number(quoteStats[0].total),
      totalRevenue: Number(revenueStats[0].total),
      avgDealSize: Number(revenueStats[0].avg),
      totalTransactions: Number(transactionStats[0].total),
      enquiryCount: Number(transactionStats[0].enquiry),
      quotedCount: Number(transactionStats[0].quoted),
      bookedCount: Number(transactionStats[0].booked),
    };
  },

  async getMyProfit(userId: string): Promise<{ profitThisMonth: number }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [result] = await db
      .select({
        profit: sql<number>`COALESCE(SUM(CAST(NULLIF(${booking.package_commission}, '') AS NUMERIC)), 0)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(
        and(
          eq(transaction.user_id, userId),
          gte(booking.date_created, startOfMonth),
          lte(booking.date_created, endOfMonth)
        )
      );

    return { profitThisMonth: Number(result?.profit || 0) };
  },
};
