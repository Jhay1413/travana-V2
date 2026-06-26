import { db } from "../../config/database";
import { clientTable, transaction, quote, booking, booking_upsell, user as userTable } from "@shared/schema";
import { sql, eq, and, gte, lte, isNull } from "drizzle-orm";
import { quoteStatsConds } from "../../utils/quote-conditions";
import { totalBookingCommissionExpr } from "../../utils/commission-sql";

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
        todayProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
        weekProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
        monthProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id));

    const bookingProfitScoped = orgId
      ? bookingProfitBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(gte(booking.date_created, weekStart), eq(transaction.is_test, false), ...orgFilter))
      : bookingProfitBase.where(and(gte(booking.date_created, weekStart), eq(transaction.is_test, false)));

    // Upsell commission is recognised by `added_at` (the period it was added),
    // independent of when the booking was created — so it is aggregated from
    // booking_upsell directly and added on top of the package-commission tiles.
    const upsellProfitBase = db
      .select({
        todayUpsell: sql<number>`COALESCE(SUM(CASE WHEN ${booking_upsell.added_at} >= ${todayStart.toISOString()} THEN CAST(${booking_upsell.commission} AS DECIMAL) ELSE 0 END), 0)`,
        weekUpsell: sql<number>`COALESCE(SUM(CASE WHEN ${booking_upsell.added_at} >= ${weekStart.toISOString()} THEN CAST(${booking_upsell.commission} AS DECIMAL) ELSE 0 END), 0)`,
        monthUpsell: sql<number>`COALESCE(SUM(CASE WHEN ${booking_upsell.added_at} >= ${monthStart.toISOString()} AND ${booking_upsell.added_at} < ${monthEnd.toISOString()} THEN CAST(${booking_upsell.commission} AS DECIMAL) ELSE 0 END), 0)`,
      })
      .from(booking_upsell)
      .innerJoin(booking, eq(booking_upsell.booking_id, booking.id))
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id));

    const upsellProfitScoped = orgId
      ? upsellProfitBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(eq(booking_upsell.is_active, true), eq(transaction.is_test, false), ...orgFilter))
      : upsellProfitBase.where(and(eq(booking_upsell.is_active, true), eq(transaction.is_test, false)));

    const bookingMonthBase = db
      .select({
        monthCount: sql<number>`COUNT(*)`,
        monthProfit: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
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

    // Per-agent booking revenue/commission for bookings CREATED this month.
    // Upsell revenue/commission is aggregated separately (agentUpsellScoped) and
    // merged in below — it must be windowed by booking_upsell.added_at, NOT gated
    // by this query's booking.date_created filter, so an upsell added this month on
    // a booking created in an earlier month is still credited to the agent.
    const agentBookingBase = db
      .select({
        agentId: transaction.user_id,
        revenue: sql<number>`COALESCE(SUM(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
        commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
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

    // Per-agent upsell revenue/commission, recognised by `added_at` this month
    // (independent of when the underlying booking was created). Merged onto the
    // booking totals above so cross-month upsells are credited correctly.
    const agentUpsellBase = db
      .select({
        agentId: transaction.user_id,
        upsellRevenue: sql<number>`COALESCE(SUM(CAST(${booking_upsell.sales_price} AS DECIMAL)), 0)`,
        upsellCommission: sql<number>`COALESCE(SUM(CAST(${booking_upsell.commission} AS DECIMAL)), 0)`,
      })
      .from(booking_upsell)
      .innerJoin(booking, eq(booking_upsell.booking_id, booking.id))
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id));

    const agentUpsellScoped = orgId
      ? agentUpsellBase
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(and(
            eq(booking_upsell.is_active, true),
            gte(booking_upsell.added_at, monthStart),
            sql`${booking_upsell.added_at} < ${monthEnd.toISOString()}`,
            eq(transaction.is_test, false),
            ...orgFilter,
          ))
          .groupBy(transaction.user_id)
      : agentUpsellBase.where(and(
          eq(booking_upsell.is_active, true),
          gte(booking_upsell.added_at, monthStart),
          sql`${booking_upsell.added_at} < ${monthEnd.toISOString()}`,
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

    const [bookingProfitStats, upsellProfitStats, bookingMonthStats, openQuoteStats, agentBookingRows, agentUpsellRows, agentQuoteRows, allUsers] = await Promise.all([
      bookingProfitScoped, upsellProfitScoped, bookingMonthScoped, openQuoteScoped, agentBookingScoped, agentUpsellScoped, agentQuoteScoped, allUsersQuery,
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
    // Add upsells (recognised by added_at) on top of the booking totals.
    for (const row of agentUpsellRows) {
      const agentId = row.agentId;
      if (agentId && agentMap.has(agentId)) {
        const agent = agentMap.get(agentId)!;
        agent.revenue += Number(row.upsellRevenue);
        agent.commission += Number(row.upsellCommission);
      }
    }
    for (const row of agentQuoteRows) {
      const agentId = row.agentId;
      if (agentId && agentMap.has(agentId)) {
        agentMap.get(agentId)!.quotes = Number(row.quotes);
      }
    }

    const bp = bookingProfitStats[0];
    const up = upsellProfitStats[0];
    const bm = bookingMonthStats[0];
    const qs = openQuoteStats[0];
    const monthCount = Number(bm.monthCount);
    // Profit tiles = package commission + upsell commission (recognised by added_at).
    const monthProfit = Number(bm.monthProfit) + Number(up.monthUpsell);

    return {
      todayProfit: Number(bp.todayProfit) + Number(up.todayUpsell),
      weekProfit: Number(bp.weekProfit) + Number(up.weekUpsell),
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
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Mirror the admin dashboard's agent-performance definition exactly so an
    // agent's own numbers match what admins see (organization-overview
    // getAgentsPerformance): full commission (package + line items), exclude
    // test/inactive bookings, and bound the month window with `< monthEnd`.
    const bookingActiveCond = sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`;
    const commission = totalBookingCommissionExpr(booking.id);

    const [bookingAgg, openQuoteAgg, upsellAgg] = await Promise.all([
      db.select({
        todayProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN ${commission} ELSE 0 END), 0)`,
        weekProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN ${commission} ELSE 0 END), 0)`,
        monthProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN ${commission} ELSE 0 END), 0)`,
        totalBookingValue: sql<number>`COALESCE(SUM(${commission}), 0)`,
        bookingsCount: sql<number>`COUNT(*)`,
      })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(and(
          eq(transaction.user_id, userId),
          eq(transaction.is_test, false),
          bookingActiveCond,
        )),

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

      // Upsell commission bucketed by added_at so that upsells added today/this-week/
      // this-month appear in the correct time bucket regardless of booking creation date.
      db.select({
        todayUpsell: sql<number>`COALESCE(SUM(CASE WHEN ${booking_upsell.added_at} >= ${todayStart.toISOString()} THEN CAST(${booking_upsell.commission} AS DECIMAL) ELSE 0 END), 0)`,
        weekUpsell: sql<number>`COALESCE(SUM(CASE WHEN ${booking_upsell.added_at} >= ${weekStart.toISOString()} THEN CAST(${booking_upsell.commission} AS DECIMAL) ELSE 0 END), 0)`,
        monthUpsell: sql<number>`COALESCE(SUM(CASE WHEN ${booking_upsell.added_at} >= ${monthStart.toISOString()} AND ${booking_upsell.added_at} < ${monthEnd.toISOString()} THEN CAST(${booking_upsell.commission} AS DECIMAL) ELSE 0 END), 0)`,
      })
        .from(booking_upsell)
        .innerJoin(booking, eq(booking_upsell.booking_id, booking.id))
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(and(
          eq(transaction.user_id, userId),
          eq(transaction.is_test, false),
          bookingActiveCond,
          sql`${booking_upsell.is_active} = true`,
        )),
    ]);

    const ba = bookingAgg[0];
    const oq = openQuoteAgg[0];
    const ua = upsellAgg[0];
    const bookingsCount = Number(ba.bookingsCount);
    const totalBookingValue = Number(ba.totalBookingValue);

    return {
      todayProfit: Number(ba.todayProfit) + Number(ua.todayUpsell),
      weekProfit: Number(ba.weekProfit) + Number(ua.weekUpsell),
      monthProfit: Number(ba.monthProfit) + Number(ua.monthUpsell),
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

      const [[bookingResult], [upsellResult]] = await Promise.all([
        db
          .select({
            // Match the admin/agent-performance definition: full booking commission
            // (package + line items), excluding test/inactive bookings.
            profit: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(
            and(
              eq(transaction.user_id, userId),
              eq(transaction.is_test, false),
              sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`,
              gte(booking.date_created, startOfMonth),
              lte(booking.date_created, endOfMonth)
            )
          ),

        // Upsell commission recognised in this calendar month by added_at.
        // A booking created last month with an upsell added this month is captured
        // here but NOT in the booking query above — this keeps month figures consistent
        // with getAgentStats and getAgentsPerformance.
        db
          .select({
            profit: sql<number>`COALESCE(SUM(CAST(${booking_upsell.commission} AS DECIMAL)), 0)`,
          })
          .from(booking_upsell)
          .innerJoin(booking, eq(booking_upsell.booking_id, booking.id))
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .where(
            and(
              eq(transaction.user_id, userId),
              eq(transaction.is_test, false),
              sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`,
              sql`${booking_upsell.is_active} = true`,
              gte(booking_upsell.added_at, startOfMonth),
              lte(booking_upsell.added_at, endOfMonth)
            )
          ),
      ]);

      const bookingProfit = Number(bookingResult?.profit || 0);
      const upsellProfit = Number(upsellResult?.profit || 0);
      return { profitThisMonth: bookingProfit + upsellProfit };
    } catch (err) {
      console.error("[dashboard] getMyProfit error:", err);
      return { profitThisMonth: 0 };
    }
  },
};
