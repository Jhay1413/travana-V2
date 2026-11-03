import { and, eq, gte, lt, sql, type SQL } from "drizzle-orm";
import { booking } from "@shared/schema";
import { bookingActiveCond, bookingNotLostCond, dealScopeConds } from "../agent-profile/agent-profile.sql";
import type { DepartureFilter } from "./departures.types";

/**
 * Where a departure row lives: organisation first (through the client), test and inactive deals out,
 * the shop narrowed when asked, live non-LOST bookings, and the travel-date window. Callers join
 * transaction and client_table.
 */
export function departureConds(f: DepartureFilter): SQL[] {
  return [
    ...dealScopeConds({ orgId: f.orgId, branchId: f.branchId ?? undefined }),
    bookingActiveCond,
    bookingNotLostCond(),
    ...(f.fromYmd ? [gte(booking.travel_date, f.fromYmd)] : []),
    ...(f.toExclYmd ? [lt(booking.travel_date, f.toExclYmd)] : []),
    ...(f.bookingId ? [eq(booking.id, f.bookingId)] : []),
  ];
}

export function departureWhere(f: DepartureFilter): SQL {
  return and(...departureConds(f)) as SQL;
}

/** Primary accommodation's destination, the same path the pipeline uses for destination_name. */
export function destinationExpr(): SQL<string | null> {
  return sql<string | null>`(
    SELECT d.name FROM booking_accomodation ba
    JOIN accomodation_list_table al ON ba.accomodation_id = al.id
    JOIN resorts_table r ON al.resorts_id = r.id
    JOIN destination_table d ON r.destination_id = d.id
    WHERE ba.booking_id = ${booking.id}
    ORDER BY ba.is_primary DESC NULLS LAST, ba.id
    LIMIT 1
  )`;
}
