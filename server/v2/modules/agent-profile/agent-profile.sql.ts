import { and, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { booking, clientTable, quote, transaction } from "@shared/schema";
import {
  totalBookingCommissionExpr,
  totalUpsellCommissionExpr,
  totalUpsellSalesExpr,
} from "../../utils/commission-sql";
import { bookingInWindow } from "../organization-overview/organization-overview.sql";
import { quoteStatsConds } from "../../utils/quote-conditions";
import type { DealFilter, TimeWindow } from "./agent-profile.types";

export const bookingActiveCond = sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`;
export const quoteActiveCond = sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`;

/**
 * Deal scope shared by every read. The organisation predicate (through the deal's client) is ALWAYS
 * first and always present, so a missing branch/user can only widen within the organisation.
 * Callers must join transaction and client_table.
 */
export function dealScopeConds(f: DealFilter): SQL[] {
  return [
    eq(clientTable.orgId, f.orgId),
    eq(transaction.is_test, false),
    eq(transaction.is_active, true),
    ...(f.branchId ? [eq(transaction.branch_id, f.branchId)] : []),
    ...(f.userId ? [eq(transaction.user_id, f.userId)] : []),
  ];
}

/** Quotes that count toward stats: not deleted, active, not free, deal has a client. */
export function countableQuoteConds(): SQL[] {
  return [isNull(quote.deleted_at), quoteActiveCond, ...quoteStatsConds()];
}

/** Booking is not lost (a NULL status counts as live). */
export function bookingNotLostCond(): SQL {
  return or(isNull(booking.booking_status), sql`${booking.booking_status} <> 'LOST'`) as SQL;
}

/**
 * Sales in the window = booking sales price (bookings created in it) + active upsell sales price
 * (upsells added in it, on any booking). Mirrors windowProfitExpr so profit and sales line up.
 */
export function windowSalesExpr(w: TimeWindow): SQL<number> {
  return sql<number>`COALESCE(SUM(CASE WHEN ${bookingInWindow(w)} THEN COALESCE(CAST(${booking.sales_price} AS DECIMAL), 0) ELSE 0 END), 0) + COALESCE(SUM(${totalUpsellSalesExpr(booking.id, { start: w.from.toISOString(), end: w.to.toISOString() })}), 0)`;
}

/**
 * All-time profit = booking commission (package + line items) + every active upsell commission.
 * LOST bookings stay in, like the dashboards and targets (accepted).
 */
export function lifetimeProfitExpr(): SQL<number> {
  return sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0) + COALESCE(SUM(${totalUpsellCommissionExpr(booking.id)}), 0)`;
}

/** Window bounds on quote creation, for pruning and for the counts themselves. */
export function quoteCreatedInWindow(w: TimeWindow): SQL {
  return and(
    sql`${quote.date_created} >= ${w.from.toISOString()}`,
    sql`${quote.date_created} < ${w.to.toISOString()}`,
  ) as SQL;
}
