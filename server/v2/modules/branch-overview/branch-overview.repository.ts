import { db } from "../../config/database";
import {
  branches,
  branchMembers,
  clientTable,
  transaction,
  booking,
  quote,
  enquiry_table,
  enquiry_destination,
  destination,
  booking_accomodation,
  accomodation_list,
  resorts,
  tickets,
  task,
  user as userTable,
} from "@shared/schema";
import { sql, eq, and, gte, lte, isNull, ne, desc, inArray, type SQL } from "drizzle-orm";
import type {
  BranchOverviewStats,
  BranchSummary,
  BranchOverviewTrendPoint,
  BranchOverviewTopRow,
  BranchOverviewTeamRow,
} from "./branch-overview.types";

interface ScopeFilter {
  orgId: string | null;
  branchId: string | null;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfWeek(d: Date) {
  const today = startOfDay(d);
  const dayOfWeek = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(monday.getDate() - (dayOfWeek - 1));
  return monday;
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Branch/org scope conditions that work for any query that joins transaction.
 * branchId takes precedence; otherwise filter by clientTable.orgId (matches the
 * dashboard module's org filter and survives platform_admin's empty orgId).
 */
function buildScopeConditions(scope: ScopeFilter): SQL[] {
  const conds: SQL[] = [eq(transaction.is_test, false)];
  if (scope.branchId) {
    conds.push(eq(transaction.branch_id, scope.branchId));
  } else if (scope.orgId) {
    conds.push(eq(clientTable.orgId, scope.orgId));
  }
  return conds;
}

function needsClientJoin(scope: ScopeFilter): boolean {
  return !scope.branchId && !!scope.orgId;
}

export const branchOverviewRepository = {
  async getStats(scope: ScopeFilter): Promise<BranchOverviewStats> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yearStart = startOfYear(now);
    const ninetyDaysAgo = addDays(todayStart, -90);
    const fourteenDaysAgo = addDays(todayStart, -14);
    const in7Days = addDays(todayStart, 7);
    const in30Days = addDays(todayStart, 30);

    const baseCond = buildScopeConditions(scope);
    const joinClient = needsClientJoin(scope);

    const [
      branchProfile,
      kpiRow,
      activeClientsRow,
      openQuotesRow,
      funnelEnquiriesRow,
      funnelQuotesRow,
      funnelBookingsRow,
      trendRows,
      topDestinationsRows,
      topResortsRows,
      teamRows,
      attentionRow,
    ] = await Promise.all([
      this.getBranchProfile(scope.branchId),

      // KPI tile aggregates against the booking table
      (() => {
        const q = db
          .select({
            todayProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
            weekProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
            monthProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
            ytdProfit: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${yearStart.toISOString()} THEN CAST(${booking.package_commission} AS DECIMAL) ELSE 0 END), 0)`,
            monthRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN CAST(${booking.sales_price} AS DECIMAL) ELSE 0 END), 0)`,
            ytdRevenue: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${yearStart.toISOString()} THEN CAST(${booking.sales_price} AS DECIMAL) ELSE 0 END), 0)`,
            monthBookingsCount: sql<number>`COUNT(*) FILTER (WHERE ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()})`,
            monthBookingValue: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN CAST(${booking.sales_price} AS DECIMAL) ELSE 0 END), 0)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient.where(and(...baseCond));
      })(),

      // Active clients in last 90 days (distinct client_id on transactions)
      (() => {
        const q = db
          .select({ count: sql<number>`COUNT(DISTINCT ${transaction.client_id})` })
          .from(transaction);
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient.where(and(gte(transaction.created_at, ninetyDaysAgo), ...baseCond));
      })(),

      // Open quotes (not yet booked / lost / deleted)
      (() => {
        const q = db
          .select({
            value: sql<number>`COALESCE(SUM(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
            count: sql<number>`COUNT(*)`,
          })
          .from(quote)
          .innerJoin(transaction, eq(quote.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient.where(
          and(
            isNull(quote.deleted_at),
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED', 'LOST'))`,
            ...baseCond,
          ),
        );
      })(),

      // Funnel — enquiries opened in the YTD window
      (() => {
        const q = db
          .select({ count: sql<number>`COUNT(*)` })
          .from(enquiry_table)
          .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient.where(
          and(
            gte(enquiry_table.date_created, yearStart),
            sql`(${enquiry_table.is_active} IS NULL OR ${enquiry_table.is_active} = true)`,
            ...baseCond,
          ),
        );
      })(),

      // Funnel — quotes created YTD
      (() => {
        const q = db
          .select({ count: sql<number>`COUNT(*)` })
          .from(quote)
          .innerJoin(transaction, eq(quote.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient.where(
          and(
            gte(quote.date_created, yearStart),
            isNull(quote.deleted_at),
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            ...baseCond,
          ),
        );
      })(),

      // Funnel — bookings created YTD
      (() => {
        const q = db
          .select({ count: sql<number>`COUNT(*)` })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient.where(
          and(
            gte(booking.date_created, yearStart),
            sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`,
            ...baseCond,
          ),
        );
      })(),

      // Last 12 months trend (revenue + booking count, bucketed by month)
      (() => {
        const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const q = db
          .select({
            month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${booking.date_created}), 'YYYY-MM')`,
            revenue: sql<number>`COALESCE(SUM(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
            bookings: sql<number>`COUNT(*)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient
          .where(and(gte(booking.date_created, trendStart), ...baseCond))
          .groupBy(sql`DATE_TRUNC('month', ${booking.date_created})`)
          .orderBy(sql`DATE_TRUNC('month', ${booking.date_created}) ASC`);
      })(),

      // Top destinations by booking count (via enquiries linked to the same transaction)
      (() => {
        const q = db
          .select({
            name: destination.name,
            bookings: sql<number>`COUNT(DISTINCT ${booking.id})`,
            revenue: sql<number>`COALESCE(SUM(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(enquiry_table, eq(enquiry_table.transaction_id, transaction.id))
          .innerJoin(enquiry_destination, eq(enquiry_destination.enquiry_id, enquiry_table.id))
          .innerJoin(destination, eq(destination.id, enquiry_destination.destination_id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient
          .where(and(gte(booking.date_created, yearStart), ...baseCond))
          .groupBy(destination.id, destination.name)
          .orderBy(desc(sql`COUNT(DISTINCT ${booking.id})`))
          .limit(5);
      })(),

      // Top resorts by booking count (via booking_accomodation → accomodation_list → resorts)
      (() => {
        const q = db
          .select({
            name: resorts.name,
            bookings: sql<number>`COUNT(DISTINCT ${booking.id})`,
            revenue: sql<number>`COALESCE(SUM(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(booking_accomodation, eq(booking_accomodation.booking_id, booking.id))
          .innerJoin(accomodation_list, eq(accomodation_list.id, booking_accomodation.accomodation_id))
          .innerJoin(resorts, eq(resorts.id, accomodation_list.resorts_id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient
          .where(and(gte(booking.date_created, yearStart), ...baseCond))
          .groupBy(resorts.id, resorts.name)
          .orderBy(desc(sql`COUNT(DISTINCT ${booking.id})`))
          .limit(5);
      })(),

      // Team leaderboard — per-user bookings/revenue/commission + quotes for the month
      this.getTeamLeaderboard(scope, monthStart, monthEnd),

      // Attention counts
      this.getAttention(scope, todayStart, in7Days, in30Days, fourteenDaysAgo),
    ]);

    const kpi = kpiRow[0];
    const monthBookingsCount = Number(kpi.monthBookingsCount);
    const monthBookingValue = Number(kpi.monthBookingValue);

    const enquiries = Number(funnelEnquiriesRow[0].count);
    const quotes = Number(funnelQuotesRow[0].count);
    const bookings = Number(funnelBookingsRow[0].count);

    const trend = this.fillTrendGaps(
      trendRows.map((r) => ({
        month: String(r.month),
        revenue: Number(r.revenue),
        bookings: Number(r.bookings),
      })),
      now,
    );

    return {
      branch: branchProfile,
      kpis: {
        todayProfit: Number(kpi.todayProfit),
        weekProfit: Number(kpi.weekProfit),
        monthProfit: Number(kpi.monthProfit),
        ytdProfit: Number(kpi.ytdProfit),
        monthRevenue: Number(kpi.monthRevenue),
        ytdRevenue: Number(kpi.ytdRevenue),
        monthBookingsCount,
        avgBookingValue: monthBookingsCount > 0 ? monthBookingValue / monthBookingsCount : 0,
        openQuotesValue: Number(openQuotesRow[0].value),
        openQuotesCount: Number(openQuotesRow[0].count),
        activeClientsCount: Number(activeClientsRow[0].count),
      },
      funnel: {
        enquiries,
        quotes,
        bookings,
        conversionRate: enquiries > 0 ? Math.round((bookings / enquiries) * 100) : 0,
      },
      trend,
      topDestinations: topDestinationsRows.map((r): BranchOverviewTopRow => ({
        name: r.name ?? "Unknown",
        bookings: Number(r.bookings),
        revenue: Number(r.revenue),
      })),
      topResorts: topResortsRows.map((r): BranchOverviewTopRow => ({
        name: r.name ?? "Unknown",
        bookings: Number(r.bookings),
        revenue: Number(r.revenue),
      })),
      teamLeaderboard: teamRows,
      attention: attentionRow,
    };
  },

  async getBranchProfile(branchId: string | null): Promise<BranchSummary | null> {
    if (!branchId) return null;
    const [row] = await db
      .select({
        id: branches.id,
        name: branches.name,
        code: branches.code,
        address: branches.address,
        phone: branches.phone,
        email: branches.email,
        isDefault: branches.isDefault,
        isActive: branches.isActive,
      })
      .from(branches)
      .where(eq(branches.id, branchId))
      .limit(1);
    if (!row) return null;
    const memberRows = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(branchMembers)
      .where(and(eq(branchMembers.branchId, branchId), eq(branchMembers.isActive, true)));
    return {
      ...row,
      memberCount: Number(memberRows[0]?.count ?? 0),
    };
  },

  async getTeamLeaderboard(
    scope: ScopeFilter,
    monthStart: Date,
    monthEnd: Date,
  ): Promise<BranchOverviewTeamRow[]> {
    const joinClient = needsClientJoin(scope);
    const baseCond = buildScopeConditions(scope);

    const bookingAgg = (() => {
      const q = db
        .select({
          agentId: transaction.user_id,
          bookings: sql<number>`COUNT(*)`,
          revenue: sql<number>`COALESCE(SUM(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
          commission: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient
        .where(
          and(
            gte(booking.date_created, monthStart),
            sql`${booking.date_created} < ${monthEnd.toISOString()}`,
            ...baseCond,
          ),
        )
        .groupBy(transaction.user_id);
    })();

    const quoteAgg = (() => {
      const q = db
        .select({
          agentId: transaction.user_id,
          quotes: sql<number>`COUNT(*)`,
        })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient
        .where(
          and(
            gte(quote.date_created, monthStart),
            sql`${quote.date_created} < ${monthEnd.toISOString()}`,
            isNull(quote.deleted_at),
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            ...baseCond,
          ),
        )
        .groupBy(transaction.user_id);
    })();

    const [bookingRows, quoteRows] = await Promise.all([bookingAgg, quoteAgg]);

    const userIds = new Set<string>();
    for (const r of bookingRows) if (r.agentId) userIds.add(r.agentId);
    for (const r of quoteRows) if (r.agentId) userIds.add(r.agentId);

    const teamUsers = scope.branchId
      ? await db
          .select({
            id: userTable.id,
            name: userTable.name,
            firstName: userTable.firstName,
            email: userTable.email,
          })
          .from(userTable)
          .innerJoin(branchMembers, eq(branchMembers.userId, userTable.id))
          .where(and(eq(branchMembers.branchId, scope.branchId), eq(branchMembers.isActive, true)))
      : scope.orgId
        ? await db
            .select({
              id: userTable.id,
              name: userTable.name,
              firstName: userTable.firstName,
              email: userTable.email,
            })
            .from(userTable)
            .where(eq(userTable.orgId, scope.orgId))
        : userIds.size > 0
          ? await db
              .select({
                id: userTable.id,
                name: userTable.name,
                firstName: userTable.firstName,
                email: userTable.email,
              })
              .from(userTable)
              .where(inArray(userTable.id, Array.from(userIds)))
          : [];

    const map = new Map<string, BranchOverviewTeamRow>();
    for (const u of teamUsers) {
      map.set(u.id, {
        id: u.id,
        name: u.firstName || u.name || u.email || "Agent",
        bookings: 0,
        revenue: 0,
        commission: 0,
        quotes: 0,
      });
    }
    for (const r of bookingRows) {
      if (!r.agentId) continue;
      if (!map.has(r.agentId)) continue;
      const row = map.get(r.agentId)!;
      row.bookings = Number(r.bookings);
      row.revenue = Number(r.revenue);
      row.commission = Number(r.commission);
    }
    for (const r of quoteRows) {
      if (!r.agentId) continue;
      if (!map.has(r.agentId)) continue;
      map.get(r.agentId)!.quotes = Number(r.quotes);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.commission - a.commission || a.name.localeCompare(b.name),
    );
  },

  async getAttention(
    scope: ScopeFilter,
    todayStart: Date,
    in7Days: Date,
    in30Days: Date,
    fourteenDaysAgo: Date,
  ) {
    const joinClient = needsClientJoin(scope);
    const baseCond = buildScopeConditions(scope);

    const upcoming7 = (() => {
      const q = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient.where(
        and(
          gte(booking.travel_date, todayStart.toISOString().slice(0, 10)),
          lte(booking.travel_date, in7Days.toISOString().slice(0, 10)),
          ...baseCond,
        ),
      );
    })();

    const upcoming30 = (() => {
      const q = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient.where(
        and(
          gte(booking.travel_date, todayStart.toISOString().slice(0, 10)),
          lte(booking.travel_date, in30Days.toISOString().slice(0, 10)),
          ...baseCond,
        ),
      );
    })();

    const staleQuotes = (() => {
      const q = db
        .select({ count: sql<number>`COUNT(*)` })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient.where(
        and(
          lte(quote.date_created, fourteenDaysAgo),
          isNull(quote.deleted_at),
          sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
          sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED', 'LOST'))`,
          ...baseCond,
        ),
      );
    })();

    const openTickets = (() => {
      const conds: SQL[] = [ne(tickets.status, "Closed")];
      if (scope.branchId) conds.push(eq(tickets.branchId, scope.branchId));
      else if (scope.orgId) conds.push(eq(tickets.orgId, scope.orgId));
      return db.select({ count: sql<number>`COUNT(*)` }).from(tickets).where(and(...conds));
    })();

    const overdueTasks = (() => {
      const conds: SQL[] = [
        sql`${task.due_date} < NOW()`,
        sql`(${task.status} IS NULL OR LOWER(${task.status}) NOT IN ('completed', 'done', 'closed'))`,
      ];
      if (scope.branchId) conds.push(eq(task.branch_id, scope.branchId));
      else if (scope.orgId) conds.push(eq(task.org_id, scope.orgId));
      return db.select({ count: sql<number>`COUNT(*)` }).from(task).where(and(...conds));
    })();

    const [u7, u30, sq, ot, od] = await Promise.all([
      upcoming7,
      upcoming30,
      staleQuotes,
      openTickets,
      overdueTasks,
    ]);

    return {
      upcomingDepartures7d: Number(u7[0]?.count ?? 0),
      upcomingDepartures30d: Number(u30[0]?.count ?? 0),
      staleQuotes: Number(sq[0]?.count ?? 0),
      openTickets: Number(ot[0]?.count ?? 0),
      overdueTasks: Number(od[0]?.count ?? 0),
    };
  },

  /** Insert zero-valued rows for any missing month so the chart renders 12 contiguous buckets. */
  fillTrendGaps(rows: BranchOverviewTrendPoint[], now: Date): BranchOverviewTrendPoint[] {
    const byMonth = new Map(rows.map((r) => [r.month, r] as const));
    const result: BranchOverviewTrendPoint[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      result.push(byMonth.get(key) ?? { month: key, revenue: 0, bookings: 0 });
    }
    return result;
  },
};
