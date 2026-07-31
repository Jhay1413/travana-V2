import { db } from "../../config/database";
import { booking, transaction, clientTable, user, forwardsReport, booking_upsell } from "@shared/schema";
import { sql, eq, and, gte, lte, isNull, isNotNull, notInArray } from "drizzle-orm";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";
import { totalBookingCommissionExpr } from "../../utils/commission-sql";

/**
 * Inclusive [start, end] `travel_date` bounds (YYYY-MM-DD) for a report month's
 * 56-day forwards window: [monthStart + 56d, monthEnd + 56d].
 *
 * Built with Date.UTC so the calendar arithmetic is independent of the server
 * timezone — round-tripping local-midnight Dates through toISOString() shifted
 * a boundary by one day on any non-UTC server, making adjacent months' windows
 * overlap and double-count bookings on the shared date.
 */
function forwardsWindow(year: number, month: number): { start: string; end: string } {
  const toDateStr = (d: Date) => d.toISOString().split("T")[0];
  return {
    // Day 0 of the next month is the last day of this month; day numbers
    // outside 1..31 roll over, so +56 stays exact across month/year ends.
    start: toDateStr(new Date(Date.UTC(year, month - 1, 1 + 56))),
    end: toDateStr(new Date(Date.UTC(year, month, 0 + 56))),
  };
}

export const revenueRepository = {
  /**
   * Upsell commission recognised in the PLAIN calendar month [start, end] by
   * `added_at` — note: NO `travel_date + 56d` offset (unlike bookings). Upsells
   * land in the month they were actually added. Returns the total and the
   * contributing upsell ids (for forwards_report.upsell_ids auditability).
   */
  async getUpsellsForCalendarMonth(year: number, month: number, orgId: string | null): Promise<{
    totalCommission: number;
    upsellIds: string[];
  }> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const conditions: any[] = [
      eq(booking_upsell.is_active, true),
      eq(booking.is_active, true),
      gte(booking_upsell.added_at, monthStart),
      lte(booking_upsell.added_at, monthEnd),
    ];
    if (orgId) conditions.push(eq(clientTable.orgId, orgId));

    const base = db
      .select({ id: booking_upsell.id, commission: booking_upsell.commission })
      .from(booking_upsell)
      .innerJoin(booking, eq(booking_upsell.booking_id, booking.id));

    const scoped = orgId
      ? base
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      : base;

    const rows = await scoped.where(and(...conditions));

    return {
      upsellIds: rows.map((r) => r.id),
      totalCommission: rows.reduce((sum, r) => sum + Number(r.commission || 0), 0),
    };
  },

  async getForwardsForMonth(year: number, month: number, orgId: string | null): Promise<{
    totalCommission: number;
    dealCount: number;
  }> {
    const window = forwardsWindow(year, month);

    const conditions: any[] = [
      gte(booking.travel_date, window.start),
      lte(booking.travel_date, window.end),
      eq(booking.is_active, true),
      isNotNull(booking.package_commission),
    ];
    if (orgId) conditions.push(eq(clientTable.orgId, orgId));

    const baseQuery = db
      .select({
        totalCommission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr()}), 0)`,
        dealCount: sql<number>`COUNT(*)`,
      })
      .from(booking);

    const scoped = orgId
      ? baseQuery
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      : baseQuery;

    const result = await scoped.where(and(...conditions));

    // Add upsells recognised in this calendar month (plain `added_at`, no offset).
    const { totalCommission: upsellCommission } = await revenueRepository.getUpsellsForCalendarMonth(year, month, orgId);

    return {
      totalCommission: Number(result[0]?.totalCommission || 0) + upsellCommission,
      dealCount: Number(result[0]?.dealCount || 0),
    };
  },

  // Same forwards window as getForwardsForMonth, but returns the contributing
  // booking IDs (for forwards_report.deal_ids) alongside the commission total.
  async getForwardsWithIdsForMonth(year: number, month: number, orgId: string | null): Promise<{
    totalCommission: number;
    dealIds: string[];
    upsellIds: string[];
  }> {
    const window = forwardsWindow(year, month);

    const conditions: any[] = [
      gte(booking.travel_date, window.start),
      lte(booking.travel_date, window.end),
      eq(booking.is_active, true),
      isNotNull(booking.package_commission),
    ];
    if (orgId) conditions.push(eq(clientTable.orgId, orgId));

    const base = db
      .select({ id: booking.id, commission: totalBookingCommissionExpr() })
      .from(booking);

    const scoped = orgId
      ? base
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      : base;

    const rows = await scoped.where(and(...conditions));

    const { totalCommission: upsellCommission, upsellIds } = await revenueRepository.getUpsellsForCalendarMonth(year, month, orgId);

    return {
      dealIds: rows.map((r) => r.id),
      upsellIds,
      totalCommission: rows.reduce((sum, r) => sum + Number(r.commission || 0), 0) + upsellCommission,
    };
  },

  // Upsert a single month's forwards_report row by (org_id, year, month) —
  // rows are per-org; orgId null is the platform-wide row written by platform
  // admins. Updates the computed columns and leaves manual `adjustment` +
  // `historical_ids` intact.
  async upsertForwardsReportMonth(input: {
    year: number;
    month: number;
    monthName: string;
    target: number;
    companyCommission: number;
    dealIds: string[];
    upsellIds: string[];
    orgId: string | null;
  }): Promise<"inserted" | "updated"> {
    const company = input.companyCommission.toFixed(2);
    const target = input.target.toFixed(2);
    const orgCondition = input.orgId
      ? eq(forwardsReport.org_id, input.orgId)
      : isNull(forwardsReport.org_id);

    const [existing] = await db
      .select({ id: forwardsReport.id })
      .from(forwardsReport)
      .where(and(eq(forwardsReport.year, input.year), eq(forwardsReport.month, input.month), orgCondition))
      .limit(1);

    if (existing) {
      await db
        .update(forwardsReport)
        .set({
          monthName: input.monthName,
          target,
          company_commission: company,
          agent_commission: "0.00",
          deal_ids: input.dealIds,
          upsell_ids: input.upsellIds,
        })
        .where(eq(forwardsReport.id, existing.id));
      return "updated";
    }

    await db.insert(forwardsReport).values({
      month: input.month,
      monthName: input.monthName,
      year: input.year,
      target,
      company_commission: company,
      agent_commission: "0.00",
      deal_ids: input.dealIds,
      upsell_ids: input.upsellIds,
      historical_ids: [],
      org_id: input.orgId,
    });
    return "inserted";
  },

  async getBookingsForMonth(year: number, month: number, orgId: string | null) {
    const window = forwardsWindow(year, month);

    const conditions: any[] = [
      gte(booking.travel_date, window.start),
      lte(booking.travel_date, window.end),
      eq(booking.is_active, true),
      isNotNull(booking.package_commission),
    ];
    if (orgId) conditions.push(eq(clientTable.orgId, orgId));

    const bookings = await db
      .select({
        bookingId: booking.id,
        clientId: clientTable.id,
        clientFirstName: clientTable.firstName,
        clientSurename: clientTable.surename,
        travelDate: booking.travel_date,
        commission: totalBookingCommissionExpr(),
        agentId: user.id,
        agentFirstName: user.firstName,
        agentLastName: user.lastName,
        title: booking.title,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .innerJoin(user, eq(transaction.user_id, user.id))
      .where(and(...conditions))
      .orderBy(booking.travel_date);

    return bookings.map((b) => ({
      bookingId: b.bookingId,
      clientId: b.clientId,
      clientFirstName: b.clientFirstName || '',
      clientSurename: b.clientSurename || '',
      travelDate: b.travelDate,
      commission: Number(b.commission || 0),
      agentId: b.agentId,
      agentFirstName: b.agentFirstName,
      agentLastName: b.agentLastName,
      title: b.title,
    }));
  },

  // Upsell detail rows recognised in the plain calendar month (by `added_at`),
  // shaped for the Forwards month drill-down alongside bookings.
  async getUpsellDetailsForCalendarMonth(year: number, month: number, orgId: string | null) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const conditions: any[] = [
      eq(booking_upsell.is_active, true),
      eq(booking.is_active, true),
      gte(booking_upsell.added_at, monthStart),
      lte(booking_upsell.added_at, monthEnd),
    ];
    if (orgId) conditions.push(eq(clientTable.orgId, orgId));

    const rows = await db
      .select({
        upsellId: booking_upsell.id,
        bookingId: booking.id,
        clientId: clientTable.id,
        clientFirstName: clientTable.firstName,
        clientSurename: clientTable.surename,
        addedAt: booking_upsell.added_at,
        commission: booking_upsell.commission,
        upsellType: booking_upsell.upsell_type,
        description: booking_upsell.description,
        agentId: user.id,
        agentFirstName: user.firstName,
        agentLastName: user.lastName,
      })
      .from(booking_upsell)
      .innerJoin(booking, eq(booking_upsell.booking_id, booking.id))
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .innerJoin(user, eq(transaction.user_id, user.id))
      .where(and(...conditions))
      .orderBy(booking_upsell.added_at);

    return rows.map((r) => ({
      upsellId: r.upsellId,
      bookingId: r.bookingId,
      clientId: r.clientId,
      clientFirstName: r.clientFirstName || '',
      clientSurename: r.clientSurename || '',
      addedAt: r.addedAt ? new Date(r.addedAt).toISOString() : '',
      commission: Number(r.commission || 0),
      upsellType: r.upsellType,
      description: r.description || '',
      agentId: r.agentId,
      agentFirstName: r.agentFirstName,
      agentLastName: r.agentLastName,
    }));
  },

  async getAgentPerformance(orgId: string | null) {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const conditions: any[] = [
      eq(booking.is_active, true),
      isNotNull(booking.package_commission),
      gte(booking.travel_date, now.toISOString().split('T')[0]),
      lte(booking.travel_date, oneYearFromNow.toISOString().split('T')[0]),
    ];
    if (orgId) conditions.push(eq(clientTable.orgId, orgId));

    // Suspended users are excluded from every report/leaderboard.
    if (orgId) {
      const suspendedIds = await userOrgRolesRepository.findSuspendedUserIds({ orgId });
      if (suspendedIds.size > 0) conditions.push(notInArray(user.id, Array.from(suspendedIds)));
    }

    const baseQuery = db
      .select({
        agentId: user.id,
        agentFirstName: user.firstName,
        agentLastName: user.lastName,
        totalCommission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr()}), 0)`,
        dealCount: sql<number>`COUNT(*)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(user, eq(transaction.user_id, user.id));

    const scoped = orgId
      ? baseQuery.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      : baseQuery;

    const results = await scoped
      .where(and(...conditions))
      .groupBy(user.id, user.firstName, user.lastName)
      .orderBy(sql`SUM(${totalBookingCommissionExpr()}) DESC`);

    return results.map((r) => ({
      agentId: r.agentId,
      agentFirstName: r.agentFirstName,
      agentLastName: r.agentLastName,
      totalCommission: Number(r.totalCommission || 0),
      dealCount: Number(r.dealCount || 0),
    }));
  },

  async getTotalStats(orgId: string | null): Promise<{
    totalCommission: number;
    totalDeals: number;
  }> {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const conditions: any[] = [
      eq(booking.is_active, true),
      isNotNull(booking.package_commission),
      gte(booking.travel_date, now.toISOString().split('T')[0]),
      lte(booking.travel_date, oneYearFromNow.toISOString().split('T')[0]),
    ];
    if (orgId) conditions.push(eq(clientTable.orgId, orgId));

    const baseQuery = db
      .select({
        totalCommission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr()}), 0)`,
        totalDeals: sql<number>`COUNT(*)`,
      })
      .from(booking);

    const scoped = orgId
      ? baseQuery
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
          .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      : baseQuery;

    const result = await scoped.where(and(...conditions));

    return {
      totalCommission: Number(result[0]?.totalCommission || 0),
      totalDeals: Number(result[0]?.totalDeals || 0),
    };
  },
};
