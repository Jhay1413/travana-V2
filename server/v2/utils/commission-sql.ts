import { sql, type SQL } from "drizzle-orm";
import {
  booking,
  quote,
  booking_flights,
  booking_accomodation,
  booking_transfers,
  booking_car_hire,
  booking_attraction_ticket,
  booking_lounge_pass,
  booking_airport_parking,
  booking_upsell,
  quote_flights,
  quote_accomodation,
  quote_transfers,
  quote_car_hire,
  quote_attraction_ticket,
  quote_lounge_pass,
  quote_airport_parking,
} from "@shared/schema";

/**
 * Total commission for a single booking row:
 *   booking.package_commission + SUM(line-item.commission) for every booking_* line-item table.
 *
 * Returned as a Drizzle SQL<number> expression so it can be embedded in SELECT lists,
 * aggregated with SUM(...), or used in ORDER BY.
 *
 * @param bookingIdRef defaults to `booking.id`; pass a different reference if the
 *   query aliases the booking table or compares against a subquery.
 */
export function totalBookingCommissionExpr(
  bookingIdRef: SQL | unknown = booking.id,
): SQL<number> {
  return sql<number>`(
    COALESCE(CAST(${booking.package_commission} AS DECIMAL), 0)
    + COALESCE((SELECT SUM(CAST(${booking_flights.commission} AS DECIMAL))           FROM ${booking_flights}           WHERE ${booking_flights.booking_id}           = ${bookingIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${booking_accomodation.commission} AS DECIMAL))      FROM ${booking_accomodation}      WHERE ${booking_accomodation.booking_id}      = ${bookingIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${booking_transfers.commission} AS DECIMAL))         FROM ${booking_transfers}         WHERE ${booking_transfers.booking_id}         = ${bookingIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${booking_car_hire.commission} AS DECIMAL))          FROM ${booking_car_hire}          WHERE ${booking_car_hire.booking_id}          = ${bookingIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${booking_attraction_ticket.commission} AS DECIMAL)) FROM ${booking_attraction_ticket} WHERE ${booking_attraction_ticket.booking_id} = ${bookingIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${booking_lounge_pass.commission} AS DECIMAL))       FROM ${booking_lounge_pass}       WHERE ${booking_lounge_pass.booking_id}       = ${bookingIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${booking_airport_parking.commission} AS DECIMAL))   FROM ${booking_airport_parking}   WHERE ${booking_airport_parking.booking_id}   = ${bookingIdRef}), 0)
  )`;
}

/**
 * Total ACTIVE upsell commission for a single booking, recognised by `added_at`.
 *
 * Deliberately kept OUT of `totalBookingCommissionExpr()` — upsell commission is
 * attributed to the month it was added, not the booking's creation/travel month.
 * Pass `range` to restrict to upsells added within a half-open `[start, end)`
 * window (e.g. a report month); omit it to sum every active upsell on the booking.
 *
 * @param bookingIdRef defaults to `booking.id`; pass a different reference when
 *   the query aliases the booking table or compares against a subquery.
 */
export function totalUpsellCommissionExpr(
  bookingIdRef: SQL | unknown = booking.id,
  range?: { start: Date | string; end: Date | string },
): SQL<number> {
  const rangeCond = range
    ? sql`AND ${booking_upsell.added_at} >= ${range.start} AND ${booking_upsell.added_at} < ${range.end}`
    : sql``;
  return sql<number>`COALESCE((
    SELECT SUM(CAST(${booking_upsell.commission} AS DECIMAL))
    FROM ${booking_upsell}
    WHERE ${booking_upsell.booking_id} = ${bookingIdRef}
      AND ${booking_upsell.is_active} = true
      ${rangeCond}
  ), 0)`;
}

/**
 * Total commission for a single quote row:
 *   quote.package_commission + SUM(line-item.commission) for every quote_* line-item table.
 */
export function totalQuoteCommissionExpr(
  quoteIdRef: SQL | unknown = quote.id,
): SQL<number> {
  return sql<number>`(
    COALESCE(CAST(${quote.package_commission} AS DECIMAL), 0)
    + COALESCE((SELECT SUM(CAST(${quote_flights.commission} AS DECIMAL))           FROM ${quote_flights}           WHERE ${quote_flights.quote_id}           = ${quoteIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${quote_accomodation.commission} AS DECIMAL))      FROM ${quote_accomodation}      WHERE ${quote_accomodation.quote_id}      = ${quoteIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${quote_transfers.commission} AS DECIMAL))         FROM ${quote_transfers}         WHERE ${quote_transfers.quote_id}         = ${quoteIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${quote_car_hire.commission} AS DECIMAL))          FROM ${quote_car_hire}          WHERE ${quote_car_hire.quote_id}          = ${quoteIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${quote_attraction_ticket.commission} AS DECIMAL)) FROM ${quote_attraction_ticket} WHERE ${quote_attraction_ticket.quote_id} = ${quoteIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${quote_lounge_pass.commission} AS DECIMAL))       FROM ${quote_lounge_pass}       WHERE ${quote_lounge_pass.quote_id}       = ${quoteIdRef}), 0)
    + COALESCE((SELECT SUM(CAST(${quote_airport_parking.commission} AS DECIMAL))   FROM ${quote_airport_parking}   WHERE ${quote_airport_parking.quote_id}   = ${quoteIdRef}), 0)
  )`;
}
