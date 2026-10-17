import { sql, and, eq, gte, lt, isNull, or, type SQL } from 'drizzle-orm';
import { booking, booking_upsell, transaction } from '@shared/schema';
import { totalBookingCommissionExpr } from '../../utils/commission-sql';

/** Half-open period window `[from, to)` as UTC-midnight instants. */
export interface StatementWindow {
  start: Date;
  end: Date;
}

export function toWindow(from: string, to: string): StatementWindow {
  return { start: new Date(`${from}T00:00:00.000Z`), end: new Date(`${to}T00:00:00.000Z`) };
}

const num = (col: unknown): SQL => sql`COALESCE(CAST(${col} AS NUMERIC), 0)`;

/** Booking commission (package + line items) as NUMERIC, so no float math touches money. */
export function bookingCommissionNumeric(): SQL {
  return sql`CAST(${totalBookingCommissionExpr()} AS NUMERIC)`;
}

/**
 * Per-booking profit base: stored sales commission - discounts - service charge.
 * Upsells are NOT part of it: they are recognised by their own added_at.
 */
export function bookingNetExpr(): SQL {
  return sql`(${bookingCommissionNumeric()} - ${num(booking.discounts)} - ${num(booking.service_charge)})`;
}

/** Upsell commission of one upsell row as NUMERIC. */
export function upsellAmountExpr(): SQL {
  return num(booking_upsell.commission);
}

/** Org, branch, test/inactive transaction and inactive-booking filters shared by both halves. */
export function statementTxnConds(orgId: string, branchId: string): SQL {
  return and(
    eq(transaction.org_id, orgId),
    eq(transaction.branch_id, branchId),
    sql`COALESCE(${transaction.is_test}, false) = false`,
    eq(transaction.is_active, true),
    or(isNull(booking.is_active), eq(booking.is_active, true)),
  ) as SQL;
}

/** (a) Bookings created in the window, scoped to the branch. */
export function statementBookingConds(orgId: string, branchId: string, w: StatementWindow): SQL {
  return and(
    statementTxnConds(orgId, branchId),
    gte(booking.date_created, w.start),
    lt(booking.date_created, w.end),
  ) as SQL;
}

/** (b) Active upsells added in the window on ANY booking of the branch (no date_created filter). */
export function statementUpsellConds(orgId: string, branchId: string, w: StatementWindow): SQL {
  return and(
    statementTxnConds(orgId, branchId),
    eq(booking_upsell.is_active, true),
    gte(booking_upsell.added_at, w.start),
    lt(booking_upsell.added_at, w.end),
  ) as SQL;
}

/** (a) SUM of booking nets for bookings created in the window, as a scalar subquery. */
export function bookingsSumSubquery(orgId: string, branchId: string, w: StatementWindow): SQL {
  return sql`(SELECT COALESCE(SUM(${bookingNetExpr()}), 0)
    FROM ${booking}
    INNER JOIN ${transaction} ON ${booking.transaction_id} = ${transaction.id}
    WHERE ${statementBookingConds(orgId, branchId, w)})`;
}

/** (b) SUM of upsell commission recognised in the window, as a scalar subquery. */
export function upsellsSumSubquery(orgId: string, branchId: string, w: StatementWindow): SQL {
  return sql`(SELECT COALESCE(SUM(${upsellAmountExpr()}), 0)
    FROM ${booking_upsell}
    INNER JOIN ${booking} ON ${booking_upsell.booking_id} = ${booking.id}
    INNER JOIN ${transaction} ON ${booking.transaction_id} = ${transaction.id}
    WHERE ${statementUpsellConds(orgId, branchId, w)})`;
}

/** Number of bookings created in the window, as a scalar subquery. */
export function bookingsCountSubquery(orgId: string, branchId: string, w: StatementWindow): SQL {
  return sql`(SELECT COUNT(${booking.id})::int
    FROM ${booking}
    INNER JOIN ${transaction} ON ${booking.transaction_id} = ${transaction.id}
    WHERE ${statementBookingConds(orgId, branchId, w)})`;
}

/** Period gross: (a) + (b), clamped at zero and rounded to 2dp. */
export function periodGrossExpr(orgId: string, branchId: string, w: StatementWindow): SQL {
  return sql`ROUND(GREATEST(${bookingsSumSubquery(orgId, branchId, w)} + ${upsellsSumSubquery(orgId, branchId, w)}, 0), 2)`;
}

/**
 * Derived single-row table `s` holding the gross once: `(SELECT <gross> AS g) AS s`.
 * The shares below reference `s.g` so the (expensive) gross is computed a single time.
 */
export function grossDerivedTable(orgId: string, branchId: string, w: StatementWindow): SQL {
  return sql`(SELECT ${periodGrossExpr(orgId, branchId, w)} AS g) AS s`;
}

/** Reference to the gross column of the derived table. */
export const derivedGross: SQL = sql`s.g`;

/** Homeworker's cut: ROUND(gross * percent / 100, 2), in SQL numeric, from `s.g`. */
export function homeworkerShareFromGross(sharePercent: string): SQL {
  return sql`ROUND(${derivedGross} * CAST(${sharePercent} AS NUMERIC) / 100, 2)`;
}

/** The org keeps the remainder, so the two shares always add back to gross exactly. */
export function orgShareFromGross(sharePercent: string): SQL {
  return sql`(${derivedGross} - ${homeworkerShareFromGross(sharePercent)})`;
}
