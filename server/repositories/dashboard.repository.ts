import { db } from "../config/database";
import { clientTable, transaction, quote, booking } from "@shared/schema";
import { sql } from "drizzle-orm";

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
};
