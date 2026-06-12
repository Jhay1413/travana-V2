import { db } from "../config/database";
import { clientTable, transaction, quote, booking, booking_upsell, user as userTable } from "@shared/schema";
import { sql, eq, and, gte, lte, ne, isNull } from "drizzle-orm";

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
      }).from(transaction).where(eq(transaction.is_test, false)),
      db.select({
        total: sql<number>`count(*)`,
      }).from(quote).innerJoin(transaction, eq(quote.transaction_id, transaction.id)).where(and(isNull(quote.deleted_at), eq(transaction.is_test, false))),
      db.select({
        total: sql<number>`COALESCE(SUM(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
        avg: sql<number>`COALESCE(AVG(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
      }).from(quote).innerJoin(transaction, eq(quote.transaction_id, transaction.id)).where(and(isNull(quote.deleted_at), eq(transaction.is_test, false))),
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

  async getAdminOverviewStats(): Promise<{
    todayProfit: number;
    weekProfit: number;
    monthProfit: number;
    monthBookingsCount: number;
    monthAvgBookingProfit: number;
    monthOpenQuotesValue: number;
    monthQuotesCount: number;
    agentPerformance: Array<{
      id: string;
      name: string;
      revenue: number;
      commission: number;
      bookings: number;
      quotes: number;
    }>;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [bookingProfitStats, bookingMonthStats, openQuoteStats, agentBookingRows, agentQuoteRows, allUsers] = await Promise.all([
      db.select({
        todayProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
        weekProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
        monthProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
      }).from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(and(gte(booking.date_created, weekStart), eq(transaction.is_test, false))),

      db.select({
        monthCount: sql<number>`COUNT(*)`,
        monthProfit: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
      }).from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(and(
          gte(booking.date_created, monthStart),
          sql`${booking.date_created} < ${monthEnd.toISOString()}`,
          eq(transaction.is_test, false),
        )),

      db.select({
        totalCommission: sql<number>`COALESCE(SUM(CAST(${quote.package_commission} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .where(and(
          gte(quote.date_created, monthStart),
          sql`${quote.date_created} < ${monthEnd.toISOString()}`,
          sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
          sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED', 'LOST'))`,
          eq(transaction.is_test, false),
        )),

      db.select({
        agentId: transaction.user_id,
        revenue: sql<number>`COALESCE(SUM(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
        commission: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
        bookings: sql<number>`COUNT(*)`,
      }).from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(and(
          gte(booking.date_created, monthStart),
          sql`${booking.date_created} < ${monthEnd.toISOString()}`,
          eq(transaction.is_test, false),
        ))
        .groupBy(transaction.user_id),

      db.select({
        agentId: transaction.user_id,
        quotes: sql<number>`COUNT(*)`,
      }).from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .where(and(
          gte(quote.date_created, monthStart),
          sql`${quote.date_created} < ${monthEnd.toISOString()}`,
          sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
          eq(transaction.is_test, false),
        ))
        .groupBy(transaction.user_id),

      db.select({
        id: userTable.id,
        name: userTable.name,
        firstName: userTable.firstName,
        email: userTable.email,
      }).from(userTable),
    ]);

    const userMap = new Map<string, string>();
    for (const u of allUsers) {
      userMap.set(u.id, u.firstName || u.name || u.email || "Agent");
    }

    const agentMap = new Map<string, { id: string; name: string; revenue: number; commission: number; bookings: number; quotes: number }>();
    for (const u of allUsers) {
      agentMap.set(u.id, {
        id: u.id,
        name: u.firstName || u.name || u.email || "Agent",
        revenue: 0,
        commission: 0,
        bookings: 0,
        quotes: 0,
      });
    }

    for (const row of agentBookingRows) {
      const agentId = row.agentId;
      if (agentId && agentMap.has(agentId)) {
        const agent = agentMap.get(agentId)!;
        agent.revenue = Number(row.revenue);
        agent.commission = Number(row.commission);
        agent.bookings = Number(row.bookings);
      }
    }
    for (const row of agentQuoteRows) {
      const agentId = row.agentId;
      if (agentId && agentMap.has(agentId)) {
        agentMap.get(agentId)!.quotes = Number(row.quotes);
      }
    }

    const bp = bookingProfitStats[0];
    const bm = bookingMonthStats[0];
    const qs = openQuoteStats[0];
    const monthCount = Number(bm.monthCount);
    const monthProfit = Number(bm.monthProfit);

    return {
      todayProfit: Number(bp.todayProfit),
      weekProfit: Number(bp.weekProfit),
      monthProfit,
      monthBookingsCount: monthCount,
      monthAvgBookingProfit: monthCount > 0 ? monthProfit / monthCount : 0,
      monthOpenQuotesValue: Number(qs.totalCommission),
      monthQuotesCount: Number(qs.count),
      agentPerformance: Array.from(agentMap.values())
        .sort((a, b) => b.commission - a.commission || a.name.localeCompare(b.name)),
    };
  },

  async getMyProfit(userId: string): Promise<{ profitThisMonth: number }> {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const [result] = await db
        .select({
          profit: sql<number>`COALESCE(SUM(${booking.package_commission}), 0)`,
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

      // Upsells are recognised in the month they were ADDED (`added_at`),
      // independent of the parent booking's creation date — so an upsell added
      // this month to an older booking still lands in this month's profit.
      const [upsellResult] = await db
        .select({
          profit: sql<number>`COALESCE(SUM(CAST(${booking_upsell.commission} AS DECIMAL)), 0)`,
        })
        .from(booking_upsell)
        .innerJoin(booking, eq(booking_upsell.booking_id, booking.id))
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(
          and(
            eq(transaction.user_id, userId),
            eq(booking_upsell.is_active, true),
            gte(booking_upsell.added_at, startOfMonth),
            lte(booking_upsell.added_at, endOfMonth)
          )
        );

      return { profitThisMonth: Number(result?.profit || 0) + Number(upsellResult?.profit || 0) };
    } catch (err) {
      console.error("[dashboard] getMyProfit error:", err);
      return { profitThisMonth: 0 };
    }
  },
};
