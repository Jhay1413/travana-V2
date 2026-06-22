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
  shopTargetTable,
  agentTargetTable,
  tour_operator,
} from "@shared/schema";
import { sql, eq, and, gte, lte, isNull, ne, desc, inArray, type SQL } from "drizzle-orm";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";
import type {
  BranchOverviewStats,
  BranchSummary,
  BranchOverviewTrendPoint,
  BranchOverviewTopRow,
  BranchOverviewTeamRow,
  AgentPerformanceRange,
  AgentPerformanceRow,
  AgentsPerformanceResponse,
} from "./branch-overview.types";
import { buildScopeConditions, needsClientJoin, type ScopeFilter } from "../../utils/scope-conditions";
import { totalBookingCommissionExpr, totalQuoteCommissionExpr } from "../../utils/commission-sql";
import { quoteStatsConds } from "../../utils/quote-conditions";

const bookingActiveCond = sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`;

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
      topTourOperatorsRows,
      teamRows,
      attentionRow,
    ] = await Promise.all([
      this.getBranchProfile(scope.branchId),

      // KPI tile aggregates against the booking table
      (() => {
        const q = db
          .select({
            todayCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
            weekCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
            monthCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
            ytdCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${yearStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
            monthBookingsCount: sql<number>`COUNT(*) FILTER (WHERE ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()})`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient.where(and(bookingActiveCond, ...baseCond));
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
            value: sql<number>`COALESCE(SUM(${totalQuoteCommissionExpr(quote.id)}), 0)`,
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
            ...quoteStatsConds(),
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
            ...quoteStatsConds(),
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

      // Calendar-year trend (Jan–Dec of the current year), commission + booking count.
      (() => {
        const trendStart = new Date(now.getFullYear(), 0, 1);
        const trendEnd = new Date(now.getFullYear() + 1, 0, 1);
        const q = db
          .select({
            month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${booking.date_created}), 'YYYY-MM')`,
            commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
            bookings: sql<number>`COUNT(*)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient
          .where(
            and(
              gte(booking.date_created, trendStart),
              sql`${booking.date_created} < ${trendEnd.toISOString()}`,
              bookingActiveCond,
              ...baseCond,
            ),
          )
          .groupBy(sql`DATE_TRUNC('month', ${booking.date_created})`)
          .orderBy(sql`DATE_TRUNC('month', ${booking.date_created}) ASC`);
      })(),

      // Top destinations by booking count (via enquiries linked to the same transaction).
      // Use a DISTINCT ON CTE to ensure each (booking, destination) pair is counted once.
      // Without deduplication, a transaction with N enquiries (or an enquiry listing the
      // same destination N times) fans out and multiplies commission by N.
      (() => {
        const innerFields = {
          // Alias each column so the CTE exposes distinct output names — otherwise
          // `booking.id` and `destination.id` both emit a column named "id" and the
          // outer query's reference is ambiguous (Postgres 42702).
          bookingId: sql<string>`${booking.id}`.as("booking_id"),
          destinationId: sql<string>`${destination.id}`.as("destination_id"),
          destinationName: sql<string>`${destination.name}`.as("destination_name"),
          commission: sql<number>`${totalBookingCommissionExpr(booking.id)}`.as("commission"),
        };
        const innerBase = db
          .selectDistinctOn([booking.id, destination.id], innerFields)
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(enquiry_table, eq(enquiry_table.transaction_id, transaction.id))
          .innerJoin(enquiry_destination, eq(enquiry_destination.enquiry_id, enquiry_table.id))
          .innerJoin(destination, eq(destination.id, enquiry_destination.destination_id));
        const innerWithClient = joinClient
          ? innerBase.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : innerBase;
        const destDeduped = db
          .$with("br_dest_deduped")
          .as(innerWithClient.where(and(gte(booking.date_created, yearStart), bookingActiveCond, ...baseCond)));
        return db
          .with(destDeduped)
          .select({
            name: destDeduped.destinationName,
            bookings: sql<number>`COUNT(DISTINCT ${destDeduped.bookingId})`,
            commission: sql<number>`COALESCE(SUM(${destDeduped.commission}), 0)`,
          })
          .from(destDeduped)
          .groupBy(destDeduped.destinationId, destDeduped.destinationName)
          .orderBy(desc(sql`COUNT(DISTINCT ${destDeduped.bookingId})`))
          .limit(5);
      })(),

      // Top resorts by booking count (via booking_accomodation → accomodation_list → resorts).
      // Use a DISTINCT ON CTE to ensure each (booking, resort) pair is counted once.
      // Without deduplication, a booking with N accommodation rows at the same resort
      // fans out and multiplies commission by N in that resort's group.
      (() => {
        const innerFields = {
          // Alias each column so the CTE exposes distinct output names — otherwise
          // `booking.id` and `resorts.id` both emit a column named "id" and the
          // outer query's reference is ambiguous (Postgres 42702).
          bookingId: sql<string>`${booking.id}`.as("booking_id"),
          resortId: sql<string>`${resorts.id}`.as("resort_id"),
          resortName: sql<string>`${resorts.name}`.as("resort_name"),
          commission: sql<number>`${totalBookingCommissionExpr(booking.id)}`.as("commission"),
        };
        const innerBase = db
          .selectDistinctOn([booking.id, resorts.id], innerFields)
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(booking_accomodation, eq(booking_accomodation.booking_id, booking.id))
          .innerJoin(accomodation_list, eq(accomodation_list.id, booking_accomodation.accomodation_id))
          .innerJoin(resorts, eq(resorts.id, accomodation_list.resorts_id));
        const innerWithClient = joinClient
          ? innerBase.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : innerBase;
        const resortDeduped = db
          .$with("br_resort_deduped")
          .as(innerWithClient.where(and(gte(booking.date_created, yearStart), bookingActiveCond, ...baseCond)));
        return db
          .with(resortDeduped)
          .select({
            name: resortDeduped.resortName,
            bookings: sql<number>`COUNT(DISTINCT ${resortDeduped.bookingId})`,
            commission: sql<number>`COALESCE(SUM(${resortDeduped.commission}), 0)`,
          })
          .from(resortDeduped)
          .groupBy(resortDeduped.resortId, resortDeduped.resortName)
          .orderBy(desc(sql`COUNT(DISTINCT ${resortDeduped.bookingId})`))
          .limit(5);
      })(),

      // Top tour operators by booking count (via booking.main_tour_operator_id)
      (() => {
        const q = db
          .select({
            name: tour_operator.name,
            bookings: sql<number>`COUNT(DISTINCT ${booking.id})`,
            commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(tour_operator, eq(tour_operator.id, booking.main_tour_operator_id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient
          .where(and(gte(booking.date_created, yearStart), bookingActiveCond, ...baseCond))
          .groupBy(tour_operator.id, tour_operator.name)
          .orderBy(desc(sql`COUNT(DISTINCT ${booking.id})`))
          .limit(5);
      })(),

      // Team leaderboard — per-user bookings/commission + quotes for the month
      this.getTeamLeaderboard(scope, monthStart, monthEnd),

      // Attention counts
      this.getAttention(scope, todayStart, in7Days, in30Days, fourteenDaysAgo),
    ]);

    // Monthly target for the branch (current month). Falls back to 0 when no shop
    // target is configured. TODO(follow-up): allow org-level/default target source.
    const monthTarget = await this.getMonthlyShopTarget(scope.branchId, now);

    // Per-month shop targets for the calendar year (used by the trend chart).
    const yearTargets = await this.getYearlyShopTargets(scope.branchId, now.getFullYear());

    const kpi = kpiRow[0];
    const monthBookingsCount = Number(kpi.monthBookingsCount);
    const monthCommission = Number(kpi.monthCommission);

    const enquiries = Number(funnelEnquiriesRow[0].count);
    const quotes = Number(funnelQuotesRow[0].count);
    const bookings = Number(funnelBookingsRow[0].count);

    const trend = this.buildYearTrend(
      trendRows.map((r) => ({
        month: String(r.month),
        commission: Number(r.commission),
        bookings: Number(r.bookings),
      })),
      yearTargets,
      now,
    );

    const leftToTargetRaw = monthTarget - monthCommission;
    const percentToTarget = monthTarget > 0 ? (monthCommission / monthTarget) * 100 : 0;
    const currentMonthName = now.toLocaleDateString("en-GB", { month: "long" });

    return {
      branch: branchProfile,
      kpis: {
        todayCommission: Number(kpi.todayCommission),
        weekCommission: Number(kpi.weekCommission),
        monthCommission,
        ytdCommission: Number(kpi.ytdCommission),
        monthBookingsCount,
        avgCommission: monthBookingsCount > 0 ? monthCommission / monthBookingsCount : 0,
        openQuotesValue: Number(openQuotesRow[0].value),
        openQuotesCount: Number(openQuotesRow[0].count),
        activeClientsCount: Number(activeClientsRow[0].count),
        monthTarget,
        leftToTarget: leftToTargetRaw,
        percentToTarget,
        currentMonthName,
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
        commission: Number(r.commission),
      })),
      topResorts: topResortsRows.map((r): BranchOverviewTopRow => ({
        name: r.name ?? "Unknown",
        bookings: Number(r.bookings),
        commission: Number(r.commission),
      })),
      topTourOperators: topTourOperatorsRows.map((r): BranchOverviewTopRow => ({
        name: r.name ?? "Unknown",
        bookings: Number(r.bookings),
        commission: Number(r.commission),
      })),
      teamLeaderboard: teamRows,
      attention: attentionRow,
    };
  },

  async branchBelongsToOrg(branchId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: branches.id })
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.organizationId, orgId)))
      .limit(1);
    return !!row;
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
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
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
            bookingActiveCond,
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
            ...quoteStatsConds(),
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

    // Leaderboards only rank sales agents. A branch manager who also sells
    // holds the `agent` role, so they stay; pure managers/admins drop out.
    const agentIds = await userOrgRolesRepository.findSalesAgentUserIds({
      orgId: scope.orgId,
      branchId: scope.branchId,
    });
    const agentSet = new Set(agentIds);

    const map = new Map<string, BranchOverviewTeamRow>();
    for (const u of teamUsers) {
      if (!agentSet.has(u.id)) continue;
      map.set(u.id, {
        id: u.id,
        name: u.firstName || u.name || u.email || "Agent",
        bookings: 0,
        commission: 0,
        quotes: 0,
      });
    }
    for (const r of bookingRows) {
      if (!r.agentId) continue;
      if (!map.has(r.agentId)) continue;
      const row = map.get(r.agentId)!;
      row.bookings = Number(r.bookings);
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
          bookingActiveCond,
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
          bookingActiveCond,
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
          ...quoteStatsConds(),
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

    const recentTicketsQ = (() => {
      const conds: SQL[] = [ne(tickets.status, "Closed")];
      if (scope.branchId) conds.push(eq(tickets.branchId, scope.branchId));
      else if (scope.orgId) conds.push(eq(tickets.orgId, scope.orgId));
      return db
        .select({
          id: tickets.id,
          subject: tickets.subject,
          status: tickets.status,
          priority: tickets.priority,
          dueDate: tickets.dueDate,
        })
        .from(tickets)
        .where(and(...conds))
        .orderBy(desc(tickets.createdAt))
        .limit(5);
    })();

    const recentTasksQ = (() => {
      const conds: SQL[] = [
        sql`(${task.status} IS NULL OR LOWER(${task.status}) NOT IN ('completed', 'done', 'closed'))`,
      ];
      if (scope.branchId) conds.push(eq(task.branch_id, scope.branchId));
      else if (scope.orgId) conds.push(eq(task.org_id, scope.orgId));
      return db
        .select({
          id: task.id,
          title: task.title,
          taskText: task.task,
          status: task.status,
          priority: task.priority,
          dueDate: task.due_date,
        })
        .from(task)
        .where(and(...conds))
        .orderBy(sql`${task.due_date} ASC NULLS LAST`)
        .limit(5);
    })();

    const [u7, u30, sq, ot, od, rt, rk] = await Promise.all([
      upcoming7,
      upcoming30,
      staleQuotes,
      openTickets,
      overdueTasks,
      recentTicketsQ,
      recentTasksQ,
    ]);

    return {
      upcomingDepartures7d: Number(u7[0]?.count ?? 0),
      upcomingDepartures30d: Number(u30[0]?.count ?? 0),
      staleQuotes: Number(sq[0]?.count ?? 0),
      openTickets: Number(ot[0]?.count ?? 0),
      overdueTasks: Number(od[0]?.count ?? 0),
      recentTickets: rt.map((r) => ({
        id: String(r.id),
        title: r.subject ?? "Untitled ticket",
        status: r.status ?? null,
        priority: r.priority ?? null,
        dueDate: r.dueDate ? String(r.dueDate) : null,
      })),
      recentTasks: rk.map((r) => ({
        id: String(r.id),
        title: r.title ?? r.taskText ?? "Untitled task",
        status: r.status ?? null,
        priority: r.priority ?? null,
        dueDate: r.dueDate ? new Date(r.dueDate).toISOString() : null,
      })),
    };
  },

  async getMonthlyShopTarget(branchId: string | null, when: Date): Promise<number> {
    if (!branchId) return 0;
    const [row] = await db
      .select({ amount: shopTargetTable.targetAmount })
      .from(shopTargetTable)
      .where(
        and(
          eq(shopTargetTable.branchId, branchId),
          eq(shopTargetTable.year, when.getFullYear()),
          eq(shopTargetTable.month, when.getMonth() + 1),
        ),
      )
      .limit(1);
    return row ? Number(row.amount) : 0;
  },

  async getAgentsPerformance(
    scope: ScopeFilter,
    range: AgentPerformanceRange,
    customFrom?: Date,
    customTo?: Date,
  ): Promise<AgentsPerformanceResponse> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let from: Date;
    let to: Date;
    if (range === "day") {
      from = todayStart;
      to = addDays(todayStart, 1);
    } else if (range === "week") {
      from = weekStart;
      to = addDays(todayStart, 1);
    } else if (range === "month") {
      from = monthStart;
      to = monthEnd;
    } else {
      from = customFrom ? startOfDay(customFrom) : monthStart;
      to = customTo ? addDays(startOfDay(customTo), 1) : monthEnd;
    }

    const joinClient = needsClientJoin(scope);
    const baseCond = buildScopeConditions(scope);

    // Per-agent aggregation across multiple windows in a single SQL pass.
    const buildAgg = () => {
      const q = db
        .select({
          agentId: transaction.user_id,
          today: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
          week: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
          month: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
          rangeBookings: sql<number>`COUNT(*) FILTER (WHERE ${booking.date_created} >= ${from.toISOString()} AND ${booking.date_created} < ${to.toISOString()})`,
          rangeCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${from.toISOString()} AND ${booking.date_created} < ${to.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient
        .where(and(bookingActiveCond, ...baseCond))
        .groupBy(transaction.user_id);
    };

    const aggRows = await buildAgg();

    // Build the agent universe: branch members when scoped to a branch, otherwise
    // every agent that has booking activity in any window.
    const userIds = new Set<string>();
    for (const r of aggRows) if (r.agentId) userIds.add(r.agentId);

    const teamUsers = scope.branchId
      ? await db
          .select({
            id: userTable.id,
            name: userTable.name,
            firstName: userTable.firstName,
            lastName: userTable.lastName,
            email: userTable.email,
            image: userTable.image,
          })
          .from(userTable)
          .innerJoin(branchMembers, eq(branchMembers.userId, userTable.id))
          .where(and(eq(branchMembers.branchId, scope.branchId), eq(branchMembers.isActive, true)))
      : userIds.size > 0
        ? await db
            .select({
              id: userTable.id,
              name: userTable.name,
              firstName: userTable.firstName,
              lastName: userTable.lastName,
              email: userTable.email,
              image: userTable.image,
            })
            .from(userTable)
            .where(inArray(userTable.id, Array.from(userIds)))
        : [];

    // Per-agent target for the current month (only meaningful when scoped to a branch).
    const targetRows = scope.branchId
      ? await db
          .select({
            userId: agentTargetTable.userId,
            amount: agentTargetTable.targetAmount,
          })
          .from(agentTargetTable)
          .where(
            and(
              eq(agentTargetTable.branchId, scope.branchId),
              eq(agentTargetTable.year, now.getFullYear()),
              eq(agentTargetTable.month, now.getMonth() + 1),
            ),
          )
      : [];
    // TODO(follow-up #35): when no per-agent target row exists for the current
    // month, fall back to a smarter default (e.g. evenly split shop target across
    // active branch members, or carry over the previous month's target).
    const targetByUser = new Map<string, number>();
    for (const t of targetRows) targetByUser.set(t.userId, Number(t.amount));

    const aggByUser = new Map(aggRows.map((r) => [r.agentId, r] as const));

    // Pure social media managers aren't sales agents — exclude from the stats.
    const socialOnly = new Set(
      await userOrgRolesRepository.findSocialOnlyUserIds({ orgId: scope.orgId, branchId: scope.branchId }),
    );

    const rows: AgentPerformanceRow[] = teamUsers.filter((u) => !socialOnly.has(u.id)).map((u) => {
      const a = aggByUser.get(u.id);
      const today = Number(a?.today ?? 0);
      const week = Number(a?.week ?? 0);
      const month = Number(a?.month ?? 0);
      const rangeBookings = Number(a?.rangeBookings ?? 0);
      const rangeCommission = Number(a?.rangeCommission ?? 0);
      const target = targetByUser.get(u.id) ?? 0;
      const achievedPercent = target > 0 ? (month / target) * 100 : 0;
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      return {
        id: u.id,
        name: fullName || u.name || u.email || "Agent",
        avatarUrl: u.image ?? null,
        today,
        week,
        month,
        rangeBookings,
        rangeCommission,
        avgPerBooking: rangeBookings > 0 ? rangeCommission / rangeBookings : 0,
        target,
        achievedPercent,
      };
    });

    // Restrict to agents that actually had activity in the selected range so
    // that the empty state surfaces correctly when nobody has booked.
    const filtered = rows.filter((r) => r.rangeBookings > 0 || r.rangeCommission > 0);

    filtered.sort((a, b) => b.rangeCommission - a.rangeCommission || a.name.localeCompare(b.name));

    return {
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      rows: filtered,
    };
  },

  async getYearlyShopTargets(branchId: string | null, year: number): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!branchId) return map;
    const rows = await db
      .select({ month: shopTargetTable.month, amount: shopTargetTable.targetAmount })
      .from(shopTargetTable)
      .where(and(eq(shopTargetTable.branchId, branchId), eq(shopTargetTable.year, year)));
    for (const r of rows) map.set(Number(r.month), Number(r.amount));
    return map;
  },

  /** Build Jan–Dec rows for the current calendar year, filling gaps and attaching targets. */
  buildYearTrend(
    rows: Array<Pick<BranchOverviewTrendPoint, "month" | "commission" | "bookings">>,
    targets: Map<number, number>,
    now: Date,
  ): BranchOverviewTrendPoint[] {
    const byMonth = new Map(rows.map((r) => [r.month, r] as const));
    const year = now.getFullYear();
    const result: BranchOverviewTrendPoint[] = [];
    for (let m = 1; m <= 12; m += 1) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      const existing = byMonth.get(key);
      result.push({
        month: key,
        commission: existing?.commission ?? 0,
        bookings: existing?.bookings ?? 0,
        target: targets.get(m) ?? 0,
      });
    }
    return result;
  },
};
