import { db } from "../../config/database";
import {
  quote_flights, quote_accomodation, quote_transfers, quote_car_hire, quote_attraction_ticket, quote_lounge_pass, quote_airport_parking,
  booking_flights, booking_accomodation, booking_transfers, booking_car_hire, booking_attraction_ticket, booking_lounge_pass, booking_airport_parking,
} from "@shared/schema";
import { sql } from "drizzle-orm";

// Sum line-item commission per quote / per booking. Mirrors the canonical
// formula in server/v2/utils/commission-sql.ts (totalQuoteCommissionExpr /
// totalBookingCommissionExpr) — all 7 line-item tables on each side. The
// caller adds package_commission separately to get the total.
//
// Each side is a single round-trip: UNION ALL across the 7 line-item tables,
// summed per id in SQL. This replaces the previous 7-queries-per-side fan-out
// (14 round-trips) and is backed by the per-table quote_id / booking_id indexes.
export async function fetchServiceCommissionMaps(
  quoteIds: string[],
  bookingIds: string[],
): Promise<{ quoteMap: Map<string, number>; bookingMap: Map<string, number> }> {
  const quoteMap = new Map<string, number>();
  const bookingMap = new Map<string, number>();

  const tasks: Promise<unknown>[] = [];

  if (quoteIds.length > 0) {
    const ids = sql.join(quoteIds.map((id) => sql`${id}`), sql`, `);
    tasks.push(
      db.execute(sql`
        SELECT id, SUM(commission) AS commission FROM (
          SELECT ${quote_flights.quote_id} AS id, ${quote_flights.commission} AS commission FROM ${quote_flights} WHERE ${quote_flights.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_accomodation.quote_id}, ${quote_accomodation.commission} FROM ${quote_accomodation} WHERE ${quote_accomodation.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_transfers.quote_id}, ${quote_transfers.commission} FROM ${quote_transfers} WHERE ${quote_transfers.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_car_hire.quote_id}, ${quote_car_hire.commission} FROM ${quote_car_hire} WHERE ${quote_car_hire.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_attraction_ticket.quote_id}, ${quote_attraction_ticket.commission} FROM ${quote_attraction_ticket} WHERE ${quote_attraction_ticket.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_lounge_pass.quote_id}, ${quote_lounge_pass.commission} FROM ${quote_lounge_pass} WHERE ${quote_lounge_pass.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_airport_parking.quote_id}, ${quote_airport_parking.commission} FROM ${quote_airport_parking} WHERE ${quote_airport_parking.quote_id} IN (${ids})
        ) t
        WHERE id IS NOT NULL
        GROUP BY id
      `).then((res) => {
        for (const r of res.rows as Array<{ id: string; commission: string | null }>) {
          quoteMap.set(r.id, parseFloat(r.commission ?? "0") || 0);
        }
      }),
    );
  }

  if (bookingIds.length > 0) {
    const ids = sql.join(bookingIds.map((id) => sql`${id}`), sql`, `);
    tasks.push(
      db.execute(sql`
        SELECT id, SUM(commission) AS commission FROM (
          SELECT ${booking_flights.booking_id} AS id, ${booking_flights.commission} AS commission FROM ${booking_flights} WHERE ${booking_flights.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_accomodation.booking_id}, ${booking_accomodation.commission} FROM ${booking_accomodation} WHERE ${booking_accomodation.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_transfers.booking_id}, ${booking_transfers.commission} FROM ${booking_transfers} WHERE ${booking_transfers.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_car_hire.booking_id}, ${booking_car_hire.commission} FROM ${booking_car_hire} WHERE ${booking_car_hire.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_attraction_ticket.booking_id}, ${booking_attraction_ticket.commission} FROM ${booking_attraction_ticket} WHERE ${booking_attraction_ticket.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_lounge_pass.booking_id}, ${booking_lounge_pass.commission} FROM ${booking_lounge_pass} WHERE ${booking_lounge_pass.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_airport_parking.booking_id}, ${booking_airport_parking.commission} FROM ${booking_airport_parking} WHERE ${booking_airport_parking.booking_id} IN (${ids})
        ) t
        WHERE id IS NOT NULL
        GROUP BY id
      `).then((res) => {
        for (const r of res.rows as Array<{ id: string; commission: string | null }>) {
          bookingMap.set(r.id, parseFloat(r.commission ?? "0") || 0);
        }
      }),
    );
  }

  await Promise.all(tasks);
  return { quoteMap, bookingMap };
}
