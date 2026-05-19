import { db } from "../../config/database";
import {
  organization,
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
import { sql, eq, and, gte, lte, isNull, ne, desc, inArray } from "drizzle-orm";
import type {
  OrganizationOverviewStats,
  OrganizationSummary,
  OrganizationOverviewTrendPoint,
  OrganizationOverviewTopRow,
  OrganizationOverviewBranchRow,
  AgentPerformanceRange,
  AgentPerformanceRow,
  AgentsPerformanceResponse,
} from "./organization-overview.types";
import { totalBookingCommissionExpr, totalQuoteCommissionExpr } from "../../utils/commission-sql";
import { quoteStatsConds } from "../../utils/quote-conditions";

const bookingActiveCond = sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`;
const testCond = eq(transaction.is_test, false);

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

export const organizationOverviewRepository = {
  async getStats(orgId: string | null): Promise<OrganizationOverviewStats> {
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

    // Org scope joins the client table for filtering. Platform admin (orgId null)
    // sees every org's data and skips the org filter entirely.
    const scopeCond = (extra: ReturnType<typeof eq>[] = []) =>
      orgId
        ? and(testCond, eq(clientTable.orgId, orgId), ...extra)
        : and(testCond, ...extra);

    const [
      orgProfile,
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
      branchRows,
      attentionRow,
    ] = await Promise.all([
      this.getOrgProfile(orgId),

      db
        .select({
          todayCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
          weekCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
          monthCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
          ytdCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${yearStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
          monthBookingsCount: sql<number>`COUNT(*) FILTER (WHERE ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()})`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(and(bookingActiveCond, scopeCond())),

      db
        .select({ count: sql<number>`COUNT(DISTINCT ${transaction.client_id})` })
        .from(transaction)
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(and(gte(transaction.created_at, ninetyDaysAgo), scopeCond())),

      db
        .select({
          value: sql<number>`COALESCE(SUM(${totalQuoteCommissionExpr(quote.id)}), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(
          and(
            isNull(quote.deleted_at),
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED', 'LOST'))`,
            ...quoteStatsConds(),
            scopeCond(),
          ),
        ),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(enquiry_table)
        .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(
          and(
            gte(enquiry_table.date_created, yearStart),
            sql`(${enquiry_table.is_active} IS NULL OR ${enquiry_table.is_active} = true)`,
            scopeCond(),
          ),
        ),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(
          and(
            gte(quote.date_created, yearStart),
            isNull(quote.deleted_at),
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            ...quoteStatsConds(),
            scopeCond(),
          ),
        ),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(
          and(
            gte(booking.date_created, yearStart),
            sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`,
            scopeCond(),
          ),
        ),

      (() => {
        const trendStart = new Date(now.getFullYear(), 0, 1);
        const trendEnd = new Date(now.getFullYear() + 1, 0, 1);
        return db
          .select({
            month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${booking.date_created}), 'YYYY-MM')`,
            commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
            bookings: sql<number>`COUNT(*)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          .where(
            and(
              gte(booking.date_created, trendStart),
              sql`${booking.date_created} < ${trendEnd.toISOString()}`,
              bookingActiveCond,
              scopeCond(),
            ),
          )
          .groupBy(sql`DATE_TRUNC('month', ${booking.date_created})`)
          .orderBy(sql`DATE_TRUNC('month', ${booking.date_created}) ASC`);
      })(),

      db
        .select({
          name: destination.name,
          bookings: sql<number>`COUNT(DISTINCT ${booking.id})`,
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .innerJoin(enquiry_table, eq(enquiry_table.transaction_id, transaction.id))
        .innerJoin(enquiry_destination, eq(enquiry_destination.enquiry_id, enquiry_table.id))
        .innerJoin(destination, eq(destination.id, enquiry_destination.destination_id))
        .where(and(gte(booking.date_created, yearStart), bookingActiveCond, scopeCond()))
        .groupBy(destination.id, destination.name)
        .orderBy(desc(sql`COUNT(DISTINCT ${booking.id})`))
        .limit(5),

      db
        .select({
          name: resorts.name,
          bookings: sql<number>`COUNT(DISTINCT ${booking.id})`,
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .innerJoin(booking_accomodation, eq(booking_accomodation.booking_id, booking.id))
        .innerJoin(accomodation_list, eq(accomodation_list.id, booking_accomodation.accomodation_id))
        .innerJoin(resorts, eq(resorts.id, accomodation_list.resorts_id))
        .where(and(gte(booking.date_created, yearStart), bookingActiveCond, scopeCond()))
        .groupBy(resorts.id, resorts.name)
        .orderBy(desc(sql`COUNT(DISTINCT ${booking.id})`))
        .limit(5),

      db
        .select({
          name: tour_operator.name,
          bookings: sql<number>`COUNT(DISTINCT ${booking.id})`,
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .innerJoin(tour_operator, eq(tour_operator.id, booking.main_tour_operator_id))
        .where(and(gte(booking.date_created, yearStart), bookingActiveCond, scopeCond()))
        .groupBy(tour_operator.id, tour_operator.name)
        .orderBy(desc(sql`COUNT(DISTINCT ${booking.id})`))
        .limit(5),

      this.getBranchLeaderboard(orgId, monthStart, monthEnd, now),

      this.getAttention(orgId, todayStart, in7Days, in30Days, fourteenDaysAgo),
    ]);

    // Org-wide monthly target = sum of every branch's shop target for the current month.
    const monthTarget = await this.getOrgMonthlyTarget(orgId, now);
    // Per-month org-wide targets (sum of branches) for the calendar year.
    const yearTargets = await this.getOrgYearlyTargets(orgId, now.getFullYear());

    const kpi = kpiRow[0];
    const monthBookingsCount = Number(kpi?.monthBookingsCount ?? 0);
    const monthCommission = Number(kpi?.monthCommission ?? 0);

    const enquiries = Number(funnelEnquiriesRow[0]?.count ?? 0);
    const quotes = Number(funnelQuotesRow[0]?.count ?? 0);
    const bookings = Number(funnelBookingsRow[0]?.count ?? 0);

    const trend = this.buildYearTrend(
      trendRows.map((r) => ({
        month: String(r.month),
        commission: Number(r.commission),
        bookings: Number(r.bookings),
      })),
      yearTargets,
      now,
    );

    const leftToTarget = monthTarget - monthCommission;
    const percentToTarget = monthTarget > 0 ? (monthCommission / monthTarget) * 100 : 0;
    const currentMonthName = now.toLocaleDateString("en-GB", { month: "long" });

    return {
      organization: orgProfile,
      kpis: {
        todayCommission: Number(kpi?.todayCommission ?? 0),
        weekCommission: Number(kpi?.weekCommission ?? 0),
        monthCommission,
        ytdCommission: Number(kpi?.ytdCommission ?? 0),
        monthBookingsCount,
        avgCommission: monthBookingsCount > 0 ? monthCommission / monthBookingsCount : 0,
        openQuotesValue: Number(openQuotesRow[0]?.value ?? 0),
        openQuotesCount: Number(openQuotesRow[0]?.count ?? 0),
        activeClientsCount: Number(activeClientsRow[0]?.count ?? 0),
        monthTarget,
        leftToTarget,
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
      topDestinations: topDestinationsRows.map((r): OrganizationOverviewTopRow => ({
        name: r.name ?? "Unknown",
        bookings: Number(r.bookings),
        commission: Number(r.commission),
      })),
      topResorts: topResortsRows.map((r): OrganizationOverviewTopRow => ({
        name: r.name ?? "Unknown",
        bookings: Number(r.bookings),
        commission: Number(r.commission),
      })),
      topTourOperators: topTourOperatorsRows.map((r): OrganizationOverviewTopRow => ({
        name: r.name ?? "Unknown",
        bookings: Number(r.bookings),
        commission: Number(r.commission),
      })),
      branchLeaderboard: branchRows,
      attention: attentionRow,
    };
  },

  async getOrgProfile(orgId: string | null): Promise<OrganizationSummary | null> {
    if (!orgId) return null;
    const [row] = await db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        plan: organization.plan,
        logoUrl: organization.logoUrl,
        isActive: organization.isActive,
        seatLimit: organization.seatLimit,
        createdAt: organization.createdAt,
      })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    if (!row) return null;

    const [branchAgg, memberAgg, clientAgg] = await Promise.all([
      db
        .select({
          total: sql<number>`COUNT(*)`,
          active: sql<number>`COUNT(*) FILTER (WHERE ${branches.isActive} = true)`,
        })
        .from(branches)
        .where(eq(branches.organizationId, orgId)),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(branchMembers)
        .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.isActive, true))),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(clientTable)
        .where(eq(clientTable.orgId, orgId)),
    ]);

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan ?? null,
      logoUrl: row.logoUrl ?? null,
      isActive: row.isActive,
      seatLimit: row.seatLimit ?? null,
      createdAt: row.createdAt ? row.createdAt.toISOString() : null,
      branchCount: Number(branchAgg[0]?.total ?? 0),
      activeBranchCount: Number(branchAgg[0]?.active ?? 0),
      memberCount: Number(memberAgg[0]?.count ?? 0),
      clientCount: Number(clientAgg[0]?.count ?? 0),
    };
  },

  async getBranchLeaderboard(
    orgId: string | null,
    monthStart: Date,
    monthEnd: Date,
    now: Date,
  ): Promise<OrganizationOverviewBranchRow[]> {
    // Pull every branch in the org first so rows with no activity still appear.
    const branchRows = orgId
      ? await db
          .select({
            id: branches.id,
            name: branches.name,
            code: branches.code,
            isActive: branches.isActive,
          })
          .from(branches)
          .where(eq(branches.organizationId, orgId))
      : await db
          .select({
            id: branches.id,
            name: branches.name,
            code: branches.code,
            isActive: branches.isActive,
          })
          .from(branches);

    if (branchRows.length === 0) return [];

    const branchIds = branchRows.map((b) => b.id);

    const [bookingRows, quoteRows, memberRows, targetRows] = await Promise.all([
      db
        .select({
          branchId: transaction.branch_id,
          bookings: sql<number>`COUNT(*)`,
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(
          and(
            gte(booking.date_created, monthStart),
            sql`${booking.date_created} < ${monthEnd.toISOString()}`,
            bookingActiveCond,
            testCond,
            inArray(transaction.branch_id, branchIds),
          ),
        )
        .groupBy(transaction.branch_id),
      db
        .select({
          branchId: transaction.branch_id,
          quotes: sql<number>`COUNT(*)`,
        })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .where(
          and(
            gte(quote.date_created, monthStart),
            sql`${quote.date_created} < ${monthEnd.toISOString()}`,
            isNull(quote.deleted_at),
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            ...quoteStatsConds(),
            testCond,
            inArray(transaction.branch_id, branchIds),
          ),
        )
        .groupBy(transaction.branch_id),
      db
        .select({
          branchId: branchMembers.branchId,
          count: sql<number>`COUNT(*)`,
        })
        .from(branchMembers)
        .where(and(eq(branchMembers.isActive, true), inArray(branchMembers.branchId, branchIds)))
        .groupBy(branchMembers.branchId),
      db
        .select({
          branchId: shopTargetTable.branchId,
          amount: shopTargetTable.targetAmount,
        })
        .from(shopTargetTable)
        .where(
          and(
            eq(shopTargetTable.year, now.getFullYear()),
            eq(shopTargetTable.month, now.getMonth() + 1),
            inArray(shopTargetTable.branchId, branchIds),
          ),
        ),
    ]);

    const bookingByBranch = new Map(bookingRows.map((r) => [r.branchId ?? "", r] as const));
    const quoteByBranch = new Map(quoteRows.map((r) => [r.branchId ?? "", r] as const));
    const memberByBranch = new Map(memberRows.map((r) => [r.branchId, Number(r.count)] as const));
    const targetByBranch = new Map(targetRows.map((r) => [r.branchId, Number(r.amount)] as const));

    const rows: OrganizationOverviewBranchRow[] = branchRows.map((b) => {
      const bk = bookingByBranch.get(b.id);
      const qt = quoteByBranch.get(b.id);
      const commission = Number(bk?.commission ?? 0);
      const target = targetByBranch.get(b.id) ?? 0;
      return {
        id: b.id,
        name: b.name,
        code: b.code ?? null,
        bookings: Number(bk?.bookings ?? 0),
        commission,
        quotes: Number(qt?.quotes ?? 0),
        monthTarget: target,
        percentToTarget: target > 0 ? (commission / target) * 100 : 0,
        memberCount: memberByBranch.get(b.id) ?? 0,
      };
    });

    rows.sort((a, b) => b.commission - a.commission || a.name.localeCompare(b.name));
    return rows;
  },

  async getAttention(
    orgId: string | null,
    todayStart: Date,
    in7Days: Date,
    in30Days: Date,
    fourteenDaysAgo: Date,
  ) {
    const scopeCond = orgId
      ? and(testCond, eq(clientTable.orgId, orgId))
      : testCond;

    const upcoming7 = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(
        and(
          gte(booking.travel_date, todayStart.toISOString().slice(0, 10)),
          lte(booking.travel_date, in7Days.toISOString().slice(0, 10)),
          bookingActiveCond,
          scopeCond,
        ),
      );

    const upcoming30 = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(
        and(
          gte(booking.travel_date, todayStart.toISOString().slice(0, 10)),
          lte(booking.travel_date, in30Days.toISOString().slice(0, 10)),
          bookingActiveCond,
          scopeCond,
        ),
      );

    const staleQuotes = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(
        and(
          lte(quote.date_created, fourteenDaysAgo),
          isNull(quote.deleted_at),
          sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
          sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED', 'LOST'))`,
          ...quoteStatsConds(),
          scopeCond,
        ),
      );

    const openTickets = orgId
      ? db
          .select({ count: sql<number>`COUNT(*)` })
          .from(tickets)
          .where(and(ne(tickets.status, "Closed"), eq(tickets.orgId, orgId)))
      : db
          .select({ count: sql<number>`COUNT(*)` })
          .from(tickets)
          .where(ne(tickets.status, "Closed"));

    const overdueTasks = orgId
      ? db
          .select({ count: sql<number>`COUNT(*)` })
          .from(task)
          .where(
            and(
              sql`${task.due_date} < NOW()`,
              sql`(${task.status} IS NULL OR LOWER(${task.status}) NOT IN ('completed', 'done', 'closed'))`,
              eq(task.org_id, orgId),
            ),
          )
      : db
          .select({ count: sql<number>`COUNT(*)` })
          .from(task)
          .where(
            and(
              sql`${task.due_date} < NOW()`,
              sql`(${task.status} IS NULL OR LOWER(${task.status}) NOT IN ('completed', 'done', 'closed'))`,
            ),
          );

    const recentTicketsQ = orgId
      ? db
          .select({
            id: tickets.id,
            subject: tickets.subject,
            status: tickets.status,
            priority: tickets.priority,
            dueDate: tickets.dueDate,
          })
          .from(tickets)
          .where(and(ne(tickets.status, "Closed"), eq(tickets.orgId, orgId)))
          .orderBy(desc(tickets.createdAt))
          .limit(5)
      : db
          .select({
            id: tickets.id,
            subject: tickets.subject,
            status: tickets.status,
            priority: tickets.priority,
            dueDate: tickets.dueDate,
          })
          .from(tickets)
          .where(ne(tickets.status, "Closed"))
          .orderBy(desc(tickets.createdAt))
          .limit(5);

    const recentTasksQ = orgId
      ? db
          .select({
            id: task.id,
            title: task.title,
            taskText: task.task,
            status: task.status,
            priority: task.priority,
            dueDate: task.due_date,
          })
          .from(task)
          .where(
            and(
              sql`(${task.status} IS NULL OR LOWER(${task.status}) NOT IN ('completed', 'done', 'closed'))`,
              eq(task.org_id, orgId),
            ),
          )
          .orderBy(sql`${task.due_date} ASC NULLS LAST`)
          .limit(5)
      : db
          .select({
            id: task.id,
            title: task.title,
            taskText: task.task,
            status: task.status,
            priority: task.priority,
            dueDate: task.due_date,
          })
          .from(task)
          .where(
            sql`(${task.status} IS NULL OR LOWER(${task.status}) NOT IN ('completed', 'done', 'closed'))`,
          )
          .orderBy(sql`${task.due_date} ASC NULLS LAST`)
          .limit(5);

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

  async getOrgMonthlyTarget(orgId: string | null, when: Date): Promise<number> {
    if (!orgId) return 0;
    const [row] = await db
      .select({
        total: sql<number>`COALESCE(SUM(${shopTargetTable.targetAmount}), 0)`,
      })
      .from(shopTargetTable)
      .innerJoin(branches, eq(branches.id, shopTargetTable.branchId))
      .where(
        and(
          eq(branches.organizationId, orgId),
          eq(shopTargetTable.year, when.getFullYear()),
          eq(shopTargetTable.month, when.getMonth() + 1),
        ),
      );
    return row ? Number(row.total) : 0;
  },

  async getOrgYearlyTargets(orgId: string | null, year: number): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!orgId) return map;
    const rows = await db
      .select({
        month: shopTargetTable.month,
        total: sql<number>`COALESCE(SUM(${shopTargetTable.targetAmount}), 0)`,
      })
      .from(shopTargetTable)
      .innerJoin(branches, eq(branches.id, shopTargetTable.branchId))
      .where(and(eq(branches.organizationId, orgId), eq(shopTargetTable.year, year)))
      .groupBy(shopTargetTable.month);
    for (const r of rows) map.set(Number(r.month), Number(r.total));
    return map;
  },

  async getAgentsPerformance(
    orgId: string | null,
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

    const scopeCond = orgId
      ? and(testCond, eq(clientTable.orgId, orgId))
      : testCond;

    const aggRows = await db
      .select({
        agentId: transaction.user_id,
        today: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${todayStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
        week: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${weekStart.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
        month: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${monthStart.toISOString()} AND ${booking.date_created} < ${monthEnd.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
        rangeBookings: sql<number>`COUNT(*) FILTER (WHERE ${booking.date_created} >= ${from.toISOString()} AND ${booking.date_created} < ${to.toISOString()})`,
        rangeCommission: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${from.toISOString()} AND ${booking.date_created} < ${to.toISOString()} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0)`,
        rangeSales: sql<number>`COALESCE(SUM(CASE WHEN ${booking.date_created} >= ${from.toISOString()} AND ${booking.date_created} < ${to.toISOString()} THEN COALESCE(${booking.sales_price}, 0) ELSE 0 END), 0)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(bookingActiveCond, scopeCond))
      .groupBy(transaction.user_id);

    const quoteAggRows = await db
      .select({
        agentId: transaction.user_id,
        rangeQuotes: sql<number>`COUNT(*) FILTER (WHERE ${quote.date_created} >= ${from.toISOString()} AND ${quote.date_created} < ${to.toISOString()})`,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(scopeCond, sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`))
      .groupBy(transaction.user_id);
    const quotesByUser = new Map<string, number>();
    for (const q of quoteAggRows) {
      if (q.agentId) quotesByUser.set(q.agentId, Number(q.rangeQuotes ?? 0));
    }

    const userIds = new Set<string>();
    for (const r of aggRows) if (r.agentId) userIds.add(r.agentId);

    const teamUsers = orgId
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
          .where(eq(userTable.orgId, orgId))
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

    // Sum per-agent targets across every branch the agent belongs to (an agent may
    // have a target row per branch in a multi-branch agency).
    const targetRows = orgId
      ? await db
          .select({
            userId: agentTargetTable.userId,
            amount: agentTargetTable.targetAmount,
          })
          .from(agentTargetTable)
          .innerJoin(branches, eq(branches.id, agentTargetTable.branchId))
          .where(
            and(
              eq(branches.organizationId, orgId),
              eq(agentTargetTable.year, now.getFullYear()),
              eq(agentTargetTable.month, now.getMonth() + 1),
            ),
          )
      : [];
    const targetByUser = new Map<string, number>();
    for (const t of targetRows) {
      targetByUser.set(t.userId, (targetByUser.get(t.userId) ?? 0) + Number(t.amount));
    }

    const aggByUser = new Map(aggRows.map((r) => [r.agentId, r] as const));

    const rows: AgentPerformanceRow[] = teamUsers.map((u) => {
      const a = aggByUser.get(u.id);
      const today = Number(a?.today ?? 0);
      const week = Number(a?.week ?? 0);
      const month = Number(a?.month ?? 0);
      const rangeBookings = Number(a?.rangeBookings ?? 0);
      const rangeCommission = Number(a?.rangeCommission ?? 0);
      const rangeSales = Number(a?.rangeSales ?? 0);
      const rangeQuotes = quotesByUser.get(u.id) ?? 0;
      const target = targetByUser.get(u.id) ?? 0;
      const achievedPercent = target > 0 ? (month / target) * 100 : 0;
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      const firstName = (u.firstName || (fullName ? fullName.split(/\s+/)[0] : "") || u.name || u.email || "Agent").trim();
      return {
        id: u.id,
        name: fullName || u.name || u.email || "Agent",
        firstName,
        avatarUrl: u.image ?? null,
        today,
        week,
        month,
        rangeBookings,
        rangeCommission,
        rangeSales,
        rangeQuotes,
        avgPerBooking: rangeBookings > 0 ? rangeCommission / rangeBookings : 0,
        target,
        achievedPercent,
      };
    });

    rows.sort((a, b) => b.rangeCommission - a.rangeCommission || a.name.localeCompare(b.name));

    return {
      range,
      from: from.toISOString(),
      to: to.toISOString(),
      rows,
    };
  },

  buildYearTrend(
    rows: Array<Pick<OrganizationOverviewTrendPoint, "month" | "commission" | "bookings">>,
    targets: Map<number, number>,
    now: Date,
  ): OrganizationOverviewTrendPoint[] {
    const byMonth = new Map(rows.map((r) => [r.month, r] as const));
    const year = now.getFullYear();
    const result: OrganizationOverviewTrendPoint[] = [];
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
