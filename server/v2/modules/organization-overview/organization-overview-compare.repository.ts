import { db } from "../../config/database";
import { booking, clientTable, quote, transaction } from "@shared/schema";
import { and, eq, gte, isNull, sql, type SQL } from "drizzle-orm";
import { quoteStatsConds } from "../../utils/quote-conditions";
import {
  bookingTouchedSinceCond,
  leadSourceKeyExpr,
  windowBookingsExpr,
  windowProfitExpr,
  windowQuotedDealsExpr,
  type SqlWindow,
} from "./organization-overview.sql";
import type { CompareTotals, ProfitSourceTotal } from "./organization-overview.types";

const bookingActiveCond = sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`;
const quoteActiveCond = sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`;

/** Org scope (joined client) + test-deal exclusion + optional branch narrowing. */
function scopeCond(orgId: string, branchId?: string): SQL | undefined {
  return and(
    eq(transaction.is_test, false),
    eq(clientTable.orgId, orgId),
    branchId ? eq(transaction.branch_id, branchId) : undefined,
  );
}

function earliest(a: Date, b: Date): Date {
  return a < b ? a : b;
}

/**
 * Org-overview reads added for the Admin Dashboard. Spread into
 * `organizationOverviewRepository`, so callers keep using that single object.
 */
export const organizationOverviewCompareRepository = {
  /** Profit, bookings and quoted-deal counts for two windows in two queries. */
  async getCompareTotals(
    orgId: string,
    windows: { now: SqlWindow; other: SqlWindow },
    branchId?: string,
  ): Promise<CompareTotals> {
    const since = earliest(windows.now.from, windows.other.from);

    const [bookingRows, quoteRows] = await Promise.all([
      db
        .select({
          nowProfit: windowProfitExpr(windows.now),
          nowBookings: windowBookingsExpr(windows.now),
          otherProfit: windowProfitExpr(windows.other),
          otherBookings: windowBookingsExpr(windows.other),
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(
          and(
            bookingActiveCond,
            eq(transaction.is_active, true),
            scopeCond(orgId, branchId),
            bookingTouchedSinceCond(since),
          ),
        ),

      db
        .select({
          nowQuoted: windowQuotedDealsExpr(windows.now),
          otherQuoted: windowQuotedDealsExpr(windows.other),
        })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        .where(
          and(
            isNull(quote.deleted_at),
            quoteActiveCond,
            ...quoteStatsConds(),
            eq(transaction.is_active, true),
            scopeCond(orgId, branchId),
            gte(quote.date_created, since),
          ),
        ),
    ]);

    const b = bookingRows[0];
    const q = quoteRows[0];
    return {
      now: {
        profit: Number(b?.nowProfit ?? 0),
        bookings: Number(b?.nowBookings ?? 0),
        quotedDeals: Number(q?.nowQuoted ?? 0),
      },
      other: {
        profit: Number(b?.otherProfit ?? 0),
        bookings: Number(b?.otherBookings ?? 0),
        quotedDeals: Number(q?.otherQuoted ?? 0),
      },
    };
  },

  /** Month profit (incl. upsells) and booking count grouped by the deal's lead source. */
  async getProfitSourceTotals(
    orgId: string,
    monthStart: Date,
    monthEnd: Date,
    branchId?: string,
  ): Promise<ProfitSourceTotal[]> {
    const month: SqlWindow = { from: monthStart, to: monthEnd };
    const sourceKey = leadSourceKeyExpr();
    const rows = await db
      .select({
        source: sourceKey,
        profit: windowProfitExpr(month),
        bookings: windowBookingsExpr(month),
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(
        and(
          bookingActiveCond,
          eq(transaction.is_active, true),
          scopeCond(orgId, branchId),
          bookingTouchedSinceCond(monthStart),
        ),
      )
      .groupBy(sourceKey);

    return rows.map((r) => ({
      source: String(r.source),
      profit: Number(r.profit ?? 0),
      bookings: Number(r.bookings ?? 0),
    }));
  },

  /**
   * Distinct active deals with at least one open quote, per owning agent
   * (transaction.user_id). Same open-quote definition as kpis.openQuotesCount.
   */
  async getOpenDealCounts(orgId: string, branchId?: string, userId?: string): Promise<Map<string, number>> {
    const rows = await db
      .select({
        agentId: transaction.user_id,
        count: sql<number>`COUNT(DISTINCT ${quote.transaction_id})`,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(
        and(
          isNull(quote.deleted_at),
          quoteActiveCond,
          sql`(${quote.quote_status} IS NULL OR UPPER(${quote.quote_status}::text) NOT IN ('BOOKED', 'BOOKING_CONFIRMED', 'LOST'))`,
          ...quoteStatsConds(),
          eq(transaction.is_active, true),
          eq(transaction.is_test, false),
          eq(clientTable.orgId, orgId),
          branchId ? eq(transaction.branch_id, branchId) : undefined,
          userId ? eq(transaction.user_id, userId) : undefined,
        ),
      )
      .groupBy(transaction.user_id);

    const byUser = new Map<string, number>();
    for (const r of rows) if (r.agentId) byUser.set(r.agentId, Number(r.count ?? 0));
    return byUser;
  },
};
