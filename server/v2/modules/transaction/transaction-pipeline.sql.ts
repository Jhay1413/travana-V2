import { sql, type SQL } from "drizzle-orm";
import { transaction, enquiry_table, quote, booking, clientTable, notes, tasks } from "@shared/schema";
import { totalBookingCommissionExpr, totalQuoteCommissionExpr } from "../../utils/commission-sql";
import type { DealPriority, PipelineFilters, PipelineQuick, PipelineSqlSort } from "./transaction.types";

// Pure Drizzle `sql` builders for the pipeline board's search / filter / sort /
// totals. Imported only by transaction.repository.ts. Every fragment correlates
// on `transaction.id`, so each one is safe to AND onto the existing scope
// conditions without widening access.

/** Escapes LIKE wildcards and wraps the term for a contains-match. */
export function escapeLike(term: string): string {
  return `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}

const num = (col: unknown): SQL => sql`COALESCE(CAST(${col} AS NUMERIC), 0)`;

/** The deal's primary quotes — same set enrichTransactionsLightweight loads. */
export function primaryQuoteConds(includeLost: boolean): SQL {
  const lostCond = includeLost ? sql`TRUE` : sql`(${quote.quote_status} IS NULL OR ${quote.quote_status} != 'lost')`;
  return sql`${quote.transaction_id} = ${transaction.id}
    AND ${quote.isFreeQuote} IS NOT TRUE
    AND ${quote.isQuoteCopy} IS NOT TRUE
    AND ${quote.deleted_at} IS NULL
    AND ${lostCond}`;
}

/** Entity ids (as text — tasks.entity_id is varchar) that a deal's tasks can hang off. */
export function dealEntityIdsSql(includeLost: boolean): SQL {
  return sql`(
    SELECT e.id::text FROM ${enquiry_table} e WHERE e.transaction_id = ${transaction.id} AND e.deleted_at IS NULL
    UNION ALL
    SELECT ${quote.id}::text FROM ${quote} WHERE ${primaryQuoteConds(includeLost)}
    UNION ALL
    SELECT ${booking.id}::text FROM ${booking} WHERE ${booking.transaction_id} = ${transaction.id}
  )`;
}

/** Mirrors the JS last_activity_at computed in enrichTransactionsLightweight. Returns timestamptz. */
export function lastActivityExpr(includeLost: boolean): SQL {
  return sql`GREATEST(
    (${transaction.created_at} AT TIME ZONE 'UTC'),
    ((SELECT MAX(${notes.createdAt}) FROM ${notes} WHERE ${notes.transaction_id} = ${transaction.id}) AT TIME ZONE 'UTC'),
    (SELECT MAX(GREATEST((${tasks.createdAt} AT TIME ZONE 'UTC'), (${tasks.completedAt} AT TIME ZONE 'UTC')))
       FROM ${tasks}
       WHERE ${tasks.entityType} IN ('enquiry', 'quote', 'booking')
         AND ${tasks.entityId} IN ${dealEntityIdsSql(includeLost)}),
    (CASE WHEN ${transaction.status} = 'on_enquiry'
       THEN (SELECT MAX(e.date_created) FROM ${enquiry_table} e WHERE e.transaction_id = ${transaction.id} AND e.deleted_at IS NULL)
     END),
    (SELECT MAX(${quote.date_created}) FROM ${quote} WHERE ${primaryQuoteConds(includeLost)}),
    (SELECT MAX(${booking.date_created}) FROM ${booking} WHERE ${booking.transaction_id} = ${transaction.id})
  )`;
}

/** An incomplete task on the deal; optionally only one due today (Europe/London calendar day). */
export function openTaskExists(opts: { includeLost: boolean; dueTodayOnly: boolean }): SQL {
  const dueToday = opts.dueTodayOnly
    ? sql`AND ((${tasks.dueDate} AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/London')::date = (NOW() AT TIME ZONE 'Europe/London')::date`
    : sql``;
  return sql`EXISTS (
    SELECT 1 FROM ${tasks}
    WHERE ${tasks.entityType} IN ('enquiry', 'quote', 'booking')
      AND ${tasks.entityId} IN ${dealEntityIdsSql(opts.includeLost)}
      AND ${tasks.completed} IS NOT TRUE
      ${dueToday}
  )`;
}

/** Quick-chip condition. Chips only apply to open columns, so lost quotes are excluded. */
export function quickCond(quick: PipelineQuick): SQL {
  switch (quick) {
    case "due_today":
      return openTaskExists({ includeLost: false, dueTodayOnly: true });
    case "no_task":
      return sql`NOT ${openTaskExists({ includeLost: false, dueTodayOnly: false })}`;
    case "quiet_7":
      return sql`${lastActivityExpr(false)} <= NOW() - INTERVAL '7 days'`;
  }
}

/** Case-insensitive contains-match over deal titles, booking refs and the client's name / phone. */
export function searchCond(term: string): SQL {
  const pattern = escapeLike(term);
  return sql`(
    EXISTS (SELECT 1 FROM ${enquiry_table} e WHERE e.transaction_id = ${transaction.id} AND e.deleted_at IS NULL AND e.title ILIKE ${pattern})
    OR EXISTS (SELECT 1 FROM ${quote} WHERE ${primaryQuoteConds(true)} AND ${quote.title} ILIKE ${pattern})
    OR EXISTS (
      SELECT 1 FROM ${booking}
      WHERE ${booking.transaction_id} = ${transaction.id}
        AND (${booking.title} ILIKE ${pattern} OR ${booking.hays_ref} ILIKE ${pattern} OR ${booking.supplier_ref} ILIKE ${pattern})
    )
    OR EXISTS (
      SELECT 1 FROM ${clientTable}
      WHERE ${clientTable.id} = ${transaction.client_id}
        AND (concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename}) ILIKE ${pattern} OR ${clientTable.phoneNumber} ILIKE ${pattern})
    )
  )`;
}

/** NULL priority counts as low (matches the `priority ?? 'low'` the API returns). */
export function priorityCond(priorities: DealPriority[]): SQL {
  const list = sql.join(priorities.map((p) => sql`${p}`), sql`, `);
  return sql`COALESCE(${transaction.priority}::text, 'low') IN (${list})`;
}

/** Primary quote OR booking uses one of the given tour operators. */
export function tourOperatorCond(ids: string[]): SQL {
  // Compared as uuid (not ::text) so the column index stays usable and
  // uppercase ids still match.
  const list = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  return sql`(
    EXISTS (SELECT 1 FROM ${quote} WHERE ${primaryQuoteConds(true)} AND ${quote.main_tour_operator_id} IN (${list}))
    OR EXISTS (SELECT 1 FROM ${booking} WHERE ${booking.transaction_id} = ${transaction.id} AND ${booking.main_tour_operator_id} IN (${list}))
  )`;
}

/**
 * Deal value, same formula as the card (client getTransactionValue):
 * sales_price - discounts + service_charge. Booked deals read the booking row,
 * quoted deals sum their primary quotes, enquiries have no value.
 */
export function dealValueExpr(includeLost: boolean): SQL {
  return sql`(CASE ${transaction.status}
    WHEN 'on_booking' THEN (
      SELECT COALESCE(SUM(${num(booking.sales_price)} - ${num(booking.discounts)} + ${num(booking.service_charge)}), 0)
      FROM ${booking} WHERE ${booking.transaction_id} = ${transaction.id}
    )
    WHEN 'on_quote' THEN (
      SELECT COALESCE(SUM(${num(quote.sales_price)} - ${num(quote.discounts)} + ${num(quote.service_charge)}), 0)
      FROM ${quote} WHERE ${primaryQuoteConds(includeLost)}
    )
    ELSE 0
  END)`;
}

/** Deal profit, same formula as the card: package commission + line-item commissions. */
export function dealProfitExpr(includeLost: boolean): SQL {
  return sql`(CASE ${transaction.status}
    WHEN 'on_booking' THEN (
      SELECT COALESCE(SUM(CAST(${totalBookingCommissionExpr()} AS NUMERIC)), 0)
      FROM ${booking} WHERE ${booking.transaction_id} = ${transaction.id}
    )
    WHEN 'on_quote' THEN (
      SELECT COALESCE(SUM(CAST(${totalQuoteCommissionExpr()} AS NUMERIC)), 0)
      FROM ${quote} WHERE ${primaryQuoteConds(includeLost)}
    )
    ELSE 0
  END)`;
}

/** Mirrors the client's getTransactionTitle (enquiry title, else first quote, else booking). */
export function titleExpr(includeLost: boolean): SQL {
  return sql`COALESCE(
    (CASE WHEN ${transaction.status} = 'on_enquiry'
       THEN NULLIF((SELECT e.title FROM ${enquiry_table} e WHERE e.transaction_id = ${transaction.id} AND e.deleted_at IS NULL LIMIT 1), '')
     END),
    NULLIF((SELECT ${quote.title} FROM ${quote} WHERE ${primaryQuoteConds(includeLost)} ORDER BY ${quote.date_created} ASC LIMIT 1), ''),
    NULLIF((SELECT ${booking.title} FROM ${booking} WHERE ${booking.transaction_id} = ${transaction.id} LIMIT 1), '')
  )`;
}

/** ORDER BY body for the SQL-side sorts introduced by the redesign. */
export function sortExpr(sort: Exclude<PipelineSqlSort, "newest" | "oldest">, includeLost: boolean): SQL {
  switch (sort) {
    case "latest_activity":
      return sql`${lastActivityExpr(includeLost)} DESC, ${transaction.created_at} DESC`;
    case "quiet_first":
      return sql`${lastActivityExpr(includeLost)} ASC, ${transaction.created_at} ASC`;
    case "value_desc":
      return sql`${dealValueExpr(includeLost)} DESC NULLS LAST, ${transaction.created_at} DESC`;
    case "profit_desc":
      return sql`${dealProfitExpr(includeLost)} DESC NULLS LAST, ${transaction.created_at} DESC`;
    case "name_asc":
      return sql`LOWER(${titleExpr(includeLost)}) ASC NULLS LAST, ${transaction.created_at} DESC`;
  }
}

/** All optional filter conditions (empty when no filter was passed). */
export function pipelineFilterConds(filters: PipelineFilters | undefined): SQL[] {
  if (!filters) return [];
  const conds: SQL[] = [];
  if (filters.search) conds.push(searchCond(filters.search));
  if (filters.priorities?.length) conds.push(priorityCond(filters.priorities));
  if (filters.tourOperatorIds?.length) conds.push(tourOperatorCond(filters.tourOperatorIds));
  if (filters.quick) conds.push(quickCond(filters.quick));
  return conds;
}
