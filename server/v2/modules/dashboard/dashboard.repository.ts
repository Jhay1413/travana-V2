import { db } from "../../config/database";
import { clientTable, transaction, quote, booking, user as userTable } from "@shared/schema";
import { sql, eq, and, gte, lte, isNull } from "drizzle-orm";
import { quoteStatsConds } from "../../utils/quote-conditions";

export const dashboardRepository = {
  async getStats(orgId: string | null) {
    const orgFilter = orgId ? [eq(clientTable.orgId, orgId)] : [];

    const clientCountQuery = orgId
      ? db.select({ count: sql<number>`count(*)` }).from(clientTable).where(eq(clientTable.orgId, orgId))
      : db.select({ count: sql<number>`count(*)` }).from(clientTable);

    const transactionStatsBase = db
      .select({
        total: sql<number>`count(*)`,
        enquiry: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_enquiry')`,
        quoted: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_quote')`,
        booked: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_booking')`,
      })
      .from(transaction);

    const transactionStatsScoped = orgId
      ? transactionStatsBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(eq(transaction.is_test, false), ...orgFilter))
      : transactionStatsBase.where(eq(transaction.is_test, false));

    const quoteStatsBase = db
      .select({ total: sql<number>`count(*)` })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id));

    const quoteStatsScoped = orgId
      ? quoteStatsBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(isNull(quote.deleted_at), eq(transaction.is_test, false), ...quoteStatsConds(), ...orgFilter))
      : quoteStatsBase.where(and(isNull(quote.deleted_at), eq(transaction.is_test, false), ...quoteStatsConds()));

    const revenueStatsBase = db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
        avg: sql<number>`COALESCE(AVG(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id));

    const revenueStatsScoped = orgId
      ? revenueStatsBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(isNull(quote.deleted_at), eq(transaction.is_test, false), ...quoteStatsConds(), ...orgFilter))
      : revenueStatsBase.where(and(isNull(quote.deleted_at), eq(transaction.is_test, false), ...quoteStatsConds()));

    const [clientCount, transactionStats, quoteStats, revenueStats] = await Promise.all([
      clientCountQuery,
      transactionStatsScoped,
      quoteStatsScoped,
      revenueStatsScoped,
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

  async getAdminOverviewStats(orgId: string | null) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const orgFilter = orgId ? [eq(clientTable.orgId, orgId)] : [];

    const bookingProfitBase = db
      .select({
        todayProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
        weekProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
        monthProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id));

    const bookingProfitScoped = orgId
      ? bookingProfitBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(gte(booking.date_created, weekStart), eq(transaction.is_test, false), ...orgFilter))
      : bookingProfitBase.where(and(gte(booking.date_created, weekStart), eq(transaction.is_test, false)));

    const bookingMonthBase = db
      .select({
        monthCount: sql<number>`COUNT(*)`,
        monthProfit: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id));

    const bookingMonthScoped = orgId
      ? bookingMonthBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(
            gte(booking.date_created, monthStart),
            sql`${booking.date_created} < ${monthEnd.toISOString()}`,
            eq(transaction.is_test, false),
            ...orgFilter,
          ))
      : bookingMonthBase.where(and(
          gte(booking.date_created, monthStart),
          sql`${booking.date_created} < ${monthEnd.toISOString()}`,
          eq(transaction.is_test, false),
        ));

    const openQuoteBase = db
      .select({
        totalCommission: sql<number>`COALESCE(SUM(CAST(${quote.package_commission} AS DECIMAL)), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id));

    const openQuoteScoped = orgId
      ? openQuoteBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(
            gte(quote.date_created, monthStart),
            sql`${quote.date_created} < ${monthEnd.toISOString()}`,
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED', 'LOST'))`,
            eq(transaction.is_test, false),
            ...quoteStatsConds(),
            ...orgFilter,
          ))
      : openQuoteBase.where(and(
          gte(quote.date_created, monthStart),
          sql`${quote.date_created} < ${monthEnd.toISOString()}`,
          sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
          sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED', 'LOST'))`,
          eq(transaction.is_test, false),
          ...quoteStatsConds(),
        ));

    const agentBookingBase = db
      .select({
        agentId: transaction.user_id,
        revenue: sql<number>`COALESCE(SUM(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
        commission: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
        bookings: sql<number>`COUNT(*)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id));

    const agentBookingScoped = orgId
      ? agentBookingBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(
            gte(booking.date_created, monthStart),
            sql`${booking.date_created} < ${monthEnd.toISOString()}`,
            eq(transaction.is_test, false),
            ...orgFilter,
          ))
          .groupBy(transaction.user_id)
      : agentBookingBase.where(and(
          gte(booking.date_created, monthStart),
          sql`${booking.date_created} < ${monthEnd.toISOString()}`,
          eq(transaction.is_test, false),
        )).groupBy(transaction.user_id);

    const agentQuoteBase = db
      .select({
        agentId: transaction.user_id,
        quotes: sql<number>`COUNT(*)`,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id));

    const agentQuoteScoped = orgId
      ? agentQuoteBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(
            gte(quote.date_created, monthStart),
            sql`${quote.date_created} < ${monthEnd.toISOString()}`,
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            eq(transaction.is_test, false),
            ...quoteStatsConds(),
            ...orgFilter,
          ))
          .groupBy(transaction.user_id)
      : agentQuoteBase.where(and(
          gte(quote.date_created, monthStart),
          sql`${quote.date_created} < ${monthEnd.toISOString()}`,
          sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
          eq(transaction.is_test, false),
          ...quoteStatsConds(),
        )).groupBy(transaction.user_id);

    const allUsersQuery = orgId
      ? db.select({ id: userTable.id, name: userTable.name, firstName: userTable.firstName, email: userTable.email }).from(userTable).where(eq(userTable.orgId, orgId))
      : db.select({ id: userTable.id, name: userTable.name, firstName: userTable.firstName, email: userTable.email }).from(userTable);

    const [bookingProfitStats, bookingMonthStats, openQuoteStats, agentBookingRows, agentQuoteRows, allUsers] = await Promise.all([
      bookingProfitScoped, bookingMonthScoped, openQuoteScoped, agentBookingScoped, agentQuoteScoped, allUsersQuery,
    ]);

    const agentMap = new Map<string, { id: string; name: string; revenue: number; commission: number; bookings: number; quotes: number }>();
    for (const u of allUsers) {
      agentMap.set(u.id, {
        id: u.id,
        name: u.firstName || u.name || u.email || "Agent",
        revenue: 0, commission: 0, bookings: 0, quotes: 0,
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

  async getAgentStats(userId: string): Promise<{
    todayProfit: number;
    weekProfit: number;
    monthProfit: number;
    bookingsCount: number;
    avgBookingValue: number;
    totalOpenQuotesValue: number;
    quotesCount: number;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [bookingAgg, openQuoteAgg] = await Promise.all([
      db.select({
        todayProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
        weekProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
        monthProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
        totalBookingValue: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
        bookingsCount: sql<number>`COUNT(*)`,
      })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(eq(transaction.user_id, userId)),

      db.select({
        totalOpenQuotesValue: sql<number>`COALESCE(SUM(CAST(${quote.package_commission} AS DECIMAL)), 0)`,
        quotesCount: sql<number>`COUNT(*)`,
      })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .where(and(
          eq(transaction.user_id, userId),
          sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
          sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED'))`,
          ...quoteStatsConds(),
        )),
    ]);

    const ba = bookingAgg[0];
    const oq = openQuoteAgg[0];
    const bookingsCount = Number(ba.bookingsCount);
    const totalBookingValue = Number(ba.totalBookingValue);

    return {
      todayProfit: Number(ba.todayProfit),
      weekProfit: Number(ba.weekProfit),
      monthProfit: Number(ba.monthProfit),
      bookingsCount,
      avgBookingValue: bookingsCount > 0 ? totalBookingValue / bookingsCount : 0,
      totalOpenQuotesValue: Number(oq.totalOpenQuotesValue),
      quotesCount: Number(oq.quotesCount),
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

      return { profitThisMonth: Number(result?.profit || 0) };
    } catch (err) {
      console.error("[dashboard] getMyProfit error:", err);
      return { profitThisMonth: 0 };
    }
  },
};
