import { sql, type SQL } from "drizzle-orm";
import { booking, booking_upsell, quote, transaction } from "@shared/schema";
import { totalBookingCommissionExpr, totalUpsellCommissionExpr } from "../../utils/commission-sql";

/** Half-open [from, to) window. Bounds are always bound as ISO-string params. */
export interface SqlWindow {
  from: Date;
  to: Date;
}

function bookingInWindow(w: SqlWindow): SQL {
  return sql`${booking.date_created} >= ${w.from.toISOString()} AND ${booking.date_created} < ${w.to.toISOString()}`;
}

/**
 * Profit in the window = booking commission (bookings created in it) + upsell
 * commission (upsells added in it, on any booking). Matches kpis.monthCommission.
 */
export function windowProfitExpr(w: SqlWindow): SQL<number> {
  return sql<number>`COALESCE(SUM(CASE WHEN ${bookingInWindow(w)} THEN ${totalBookingCommissionExpr(booking.id)} ELSE 0 END), 0) + COALESCE(SUM(${totalUpsellCommissionExpr(booking.id, { start: w.from.toISOString(), end: w.to.toISOString() })}), 0)`;
}

export function windowBookingsExpr(w: SqlWindow): SQL<number> {
  return sql<number>`COUNT(*) FILTER (WHERE ${bookingInWindow(w)})`;
}

/** Distinct deals that had a (counted) quote created in the window. */
export function windowQuotedDealsExpr(w: SqlWindow): SQL<number> {
  return sql<number>`COUNT(DISTINCT ${transaction.id}) FILTER (WHERE ${quote.date_created} >= ${w.from.toISOString()} AND ${quote.date_created} < ${w.to.toISOString()})`;
}

/**
 * Bookings that can contribute to a window starting at `start`: created since,
 * or carrying an active upsell added since (the upsell counts in its own window).
 */
export function bookingTouchedSinceCond(start: Date): SQL {
  const iso = start.toISOString();
  return sql`(${booking.date_created} >= ${iso} OR EXISTS (SELECT 1 FROM ${booking_upsell} WHERE ${booking_upsell.booking_id} = ${booking.id} AND ${booking_upsell.is_active} = true AND ${booking_upsell.added_at} >= ${iso}))`;
}

/** Lead source of the deal; 'none' when the deal has none. */
export function leadSourceKeyExpr(): SQL<string> {
  return sql<string>`COALESCE(${transaction.lead_source}::text, 'none')`;
}
