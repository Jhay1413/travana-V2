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
